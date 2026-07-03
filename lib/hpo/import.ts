import { existsSync, statSync } from "node:fs";
import { basename } from "node:path";

import type { PrismaClient } from "@prisma/client";

import { HPO_SOURCE_NAMES } from "./constants";
import { HpoParseError } from "./errors";
import { sha256File, sha256Text } from "./hash";
import { parseGenesToPhenotypeFile } from "./parse-genes-to-phenotype";
import { parseOboFile } from "./parse-obo";
import { parsePhenotypeToGenesFile } from "./parse-phenotype-to-genes";
import type {
  GenePhenotypeAssociationInput,
  HpoImportCounts,
  HpoImportInput,
  ParsedGeneAssociations,
} from "./types";

function requireReadableFile(path: string): void {
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new HpoParseError(`Required HPO source file is missing: ${basename(path)}.`);
  }
}

function versionFromChecksum(checksum: string): string {
  return `sha256:${checksum.slice(0, 12)}`;
}

function report(input: HpoImportInput, message: string): void {
  input.onProgress?.(message);
}

function totalBatches(total: number, batchSize: number): number {
  return Math.max(1, Math.ceil(total / batchSize));
}

function batchProgressLabel(index: number, total: number, batchSize: number): string {
  const batchNumber = Math.floor(index / batchSize) + 1;
  const end = Math.min(index + batchSize, total);
  return `batch ${batchNumber}/${totalBatches(total, batchSize)} (${end}/${total})`;
}

function nullable(value: string | undefined): string | null {
  return value ?? null;
}

async function loadTermIds(
  prisma: PrismaClient,
  hpoIds: string[],
  batchSize: number,
): Promise<Map<string, string>> {
  const termIdByHpoId = new Map<string, string>();
  const uniqueHpoIds = Array.from(new Set(hpoIds));
  for (let index = 0; index < uniqueHpoIds.length; index += batchSize) {
    const chunk = uniqueHpoIds.slice(index, index + batchSize);
    const terms = await prisma.phenotypeTerm.findMany({
      where: { hpoId: { in: chunk } },
      select: { id: true, hpoId: true },
    });
    for (const term of terms) termIdByHpoId.set(term.hpoId, term.id);
  }
  return termIdByHpoId;
}

async function loadGeneIds(
  prisma: PrismaClient,
  geneSymbols: string[],
  batchSize: number,
): Promise<Map<string, string>> {
  const geneIdBySymbol = new Map<string, string>();
  const uniqueSymbols = Array.from(new Set(geneSymbols));
  for (let index = 0; index < uniqueSymbols.length; index += batchSize) {
    const chunk = uniqueSymbols.slice(index, index + batchSize);
    const genes = await prisma.gene.findMany({
      where: { symbol: { in: chunk } },
      select: { id: true, symbol: true },
    });
    for (const gene of genes) geneIdBySymbol.set(gene.symbol, gene.id);
  }
  return geneIdBySymbol;
}

function mergeAssociations(parsed: ParsedGeneAssociations[]): {
  associations: GenePhenotypeAssociationInput[];
  warnings: string[];
} {
  const warnings = parsed.flatMap((entry) => entry.warnings);
  const seen = new Set<string>();
  const associations: GenePhenotypeAssociationInput[] = [];
  for (const entry of parsed) {
    for (const association of entry.associations) {
      const key = [
        association.geneSymbol,
        association.hpoId,
        association.diseaseId ?? "",
        association.evidenceSource ?? "",
      ].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      associations.push(association);
    }
  }
  return { associations, warnings };
}

export async function importHpoData(
  prisma: PrismaClient,
  input: HpoImportInput,
): Promise<HpoImportCounts> {
  requireReadableFile(input.ontologyPath);

  const batchSize = Math.max(1, Math.min(input.batchSize ?? 1_000, 5_000));

  report(input, `Parsing hp.obo started: ${input.ontologyPath}`);
  const ontology = await parseOboFile(input.ontologyPath);
  const synonymTotal = ontology.terms.reduce((sum, term) => sum + term.synonyms.length, 0);
  report(
    input,
    `Parsing hp.obo finished: ${ontology.terms.length} terms, ${ontology.relationships.length} relationships, ${synonymTotal} synonyms, ${ontology.warnings.length} warnings.`,
  );
  const ontologyChecksum = await sha256File(input.ontologyPath);

  const parsedAssociationFiles: ParsedGeneAssociations[] = [];
  const associationHashes: Record<string, string> = {};
  const associationLimit =
    input.associationLimit !== undefined
      ? Math.max(0, Math.floor(input.associationLimit))
      : undefined;
  let remainingAssociationLimit = associationLimit;
  const associationLimitWarnings: string[] = [];

  async function parseAssociationFile(
    label: string,
    path: string | undefined,
    parseFile: (filePath: string, options?: { limit?: number }) => Promise<ParsedGeneAssociations>,
  ): Promise<void> {
    if (!path || !existsSync(path)) return;
    if (remainingAssociationLimit !== undefined && remainingAssociationLimit <= 0) {
      associationLimitWarnings.push(
        `${basename(path)} skipped because the HPO association import limit was reached.`,
      );
      return;
    }

    report(input, `Parsing ${label} started: ${path}`);
    const parsed = await parseFile(path, { limit: remainingAssociationLimit });
    parsedAssociationFiles.push(parsed);
    associationHashes[basename(path)] = await sha256File(path);
    report(
      input,
      `Parsing ${label} finished: ${parsed.associations.length} associations, ${parsed.warnings.length} warnings${
        parsed.truncated ? ", truncated by fixture import limit" : ""
      }.`,
    );
    if (remainingAssociationLimit !== undefined) {
      remainingAssociationLimit = Math.max(
        0,
        remainingAssociationLimit - parsed.associations.length,
      );
    }
  }

  await parseAssociationFile(
    "phenotype_to_genes",
    input.phenotypeToGenesPath,
    parsePhenotypeToGenesFile,
  );
  await parseAssociationFile(
    "genes_to_phenotype",
    input.genesToPhenotypePath,
    parseGenesToPhenotypeFile,
  );

  const merged = mergeAssociations(parsedAssociationFiles);
  merged.warnings.push(...associationLimitWarnings);
  const associationsToImport =
    associationLimit === undefined
      ? merged.associations
      : merged.associations.slice(0, associationLimit);
  const associationLimitApplied =
    associationLimit !== undefined &&
    (associationsToImport.length < merged.associations.length ||
      parsedAssociationFiles.some((entry) => entry.truncated) ||
      associationLimitWarnings.length > 0);
  const associationsSkipped = associationLimitApplied
    ? Math.max(0, merged.associations.length - associationsToImport.length)
    : 0;
  const parsedGeneSymbols = new Set(
    associationsToImport.map((association) => association.geneSymbol),
  );
  report(
    input,
    `Parsed HPO totals before database import: ${ontology.terms.length} terms, ${parsedGeneSymbols.size} genes, ${associationsToImport.length} associations.`,
  );
  report(input, `Database import starting with batch size ${batchSize}.`);

  const ontologySource = await prisma.dataSourceVersion.upsert({
    where: {
      sourceName_version: {
        sourceName: HPO_SOURCE_NAMES.ontology,
        version: versionFromChecksum(ontologyChecksum),
      },
    },
    update: {
      sourceType: "hpo_ontology",
      checksum: ontologyChecksum,
      importedAt: new Date(),
      metadata: {
        fileName: basename(input.ontologyPath),
        importedTermCount: ontology.terms.length,
        importedSynonymCount: synonymTotal,
        importedRelationshipCount: ontology.relationships.length,
        warnings: ontology.warnings,
      },
    },
    create: {
      sourceName: HPO_SOURCE_NAMES.ontology,
      sourceType: "hpo_ontology",
      version: versionFromChecksum(ontologyChecksum),
      checksum: ontologyChecksum,
      importedAt: new Date(),
      metadata: {
        fileName: basename(input.ontologyPath),
        importedTermCount: ontology.terms.length,
        importedSynonymCount: synonymTotal,
        importedRelationshipCount: ontology.relationships.length,
        warnings: ontology.warnings,
      },
    },
  });

  for (let index = 0; index < ontology.terms.length; index += batchSize) {
    const chunk = ontology.terms.slice(index, index + batchSize);
    report(
      input,
      `Database import: phenotype terms ${batchProgressLabel(index, ontology.terms.length, batchSize)}.`,
    );
    await prisma.$transaction(
      chunk.map((term) =>
        prisma.phenotypeTerm.upsert({
          where: { hpoId: term.hpoId },
          update: {
            label: term.label,
            definition: term.definition,
            comment: term.comment,
            isObsolete: term.isObsolete,
            replacedBy: term.replacedBy,
            altIds: term.altIds,
            sourceVersionId: ontologySource.id,
          },
          create: {
            hpoId: term.hpoId,
            label: term.label,
            definition: term.definition,
            comment: term.comment,
            isObsolete: term.isObsolete,
            replacedBy: term.replacedBy,
            altIds: term.altIds,
            sourceVersionId: ontologySource.id,
          },
        }),
      ),
    );
  }

  const termIdByHpoId = await loadTermIds(
    prisma,
    ontology.terms.map((term) => term.hpoId),
    batchSize,
  );

  const synonyms = ontology.terms.flatMap((term) => {
    const termId = termIdByHpoId.get(term.hpoId);
    if (!termId) return [];
    return term.synonyms.map((synonym) => ({ termId, synonym }));
  });
  for (let index = 0; index < synonyms.length; index += batchSize) {
    const chunk = synonyms.slice(index, index + batchSize);
    report(
      input,
      `Database import: phenotype synonyms ${batchProgressLabel(index, synonyms.length, batchSize)}.`,
    );
    await prisma.$transaction(
      chunk.map(({ termId, synonym }) =>
        prisma.phenotypeSynonym.upsert({
          where: { termId_synonym: { termId, synonym: synonym.value } },
          update: { synonymType: synonym.scope, source: synonym.source ?? "hp.obo" },
          create: {
            termId,
            synonym: synonym.value,
            synonymType: synonym.scope,
            source: synonym.source ?? "hp.obo",
          },
        }),
      ),
    );
  }

  const relationships = ontology.relationships
    .map((relationship) => {
      const parentTermId = termIdByHpoId.get(relationship.parentHpoId);
      const childTermId = termIdByHpoId.get(relationship.childHpoId);
      return parentTermId && childTermId
        ? { parentTermId, childTermId, relationshipType: relationship.relationshipType }
        : undefined;
    })
    .filter((relationship): relationship is NonNullable<typeof relationship> =>
      Boolean(relationship),
    );
  for (let index = 0; index < relationships.length; index += batchSize) {
    const chunk = relationships.slice(index, index + batchSize);
    report(
      input,
      `Database import: phenotype relationships ${batchProgressLabel(index, relationships.length, batchSize)}.`,
    );
    await prisma.$transaction(
      chunk.map((relationship) =>
        prisma.phenotypeRelationship.upsert({
          where: {
            parentTermId_childTermId_relationshipType: relationship,
          },
          update: {},
          create: relationship,
        }),
      ),
    );
  }

  const associationChecksum = sha256Text(JSON.stringify(associationHashes));
  const associationSource = await prisma.dataSourceVersion.upsert({
    where: {
      sourceName_version: {
        sourceName: HPO_SOURCE_NAMES.geneAssociations,
        version: versionFromChecksum(associationChecksum),
      },
    },
    update: {
      sourceType: "hpo_gene_association",
      checksum: associationChecksum,
      importedAt: new Date(),
      metadata: {
        fileHashes: associationHashes,
        availableAssociationCount: merged.associations.length,
        importedAssociationCount: associationsToImport.length,
        associationImportLimit: associationLimit,
        associationImportLimitApplied: associationsSkipped > 0,
        warnings: merged.warnings,
      },
    },
    create: {
      sourceName: HPO_SOURCE_NAMES.geneAssociations,
      sourceType: "hpo_gene_association",
      version: versionFromChecksum(associationChecksum),
      checksum: associationChecksum,
      importedAt: new Date(),
      metadata: {
        fileHashes: associationHashes,
        availableAssociationCount: merged.associations.length,
        importedAssociationCount: associationsToImport.length,
        associationImportLimit: associationLimit,
        associationImportLimitApplied: associationsSkipped > 0,
        warnings: merged.warnings,
      },
    },
  });

  const geneBySymbol = new Map<string, GenePhenotypeAssociationInput>();
  for (const association of associationsToImport) {
    if (!geneBySymbol.has(association.geneSymbol)) {
      geneBySymbol.set(association.geneSymbol, association);
    }
  }
  const genesToImport = Array.from(geneBySymbol.values());
  for (let index = 0; index < genesToImport.length; index += batchSize) {
    const chunk = genesToImport.slice(index, index + batchSize);
    report(
      input,
      `Database import: genes ${batchProgressLabel(index, genesToImport.length, batchSize)}.`,
    );
    await prisma.$transaction(
      chunk.map((association) =>
        prisma.gene.upsert({
          where: { symbol: association.geneSymbol },
          update: {
            entrezId: association.geneId,
            sourceVersionId: associationSource.id,
          },
          create: {
            symbol: association.geneSymbol,
            entrezId: association.geneId,
            isValidated: false,
            validationStatus: "UNVALIDATED",
            sourceVersionId: associationSource.id,
          },
        }),
      ),
    );
  }

  const missingAssociationTerms = new Map<string, GenePhenotypeAssociationInput>();
  for (const association of associationsToImport) {
    if (!termIdByHpoId.has(association.hpoId) && !missingAssociationTerms.has(association.hpoId)) {
      missingAssociationTerms.set(association.hpoId, association);
    }
  }
  const missingTermsToImport = Array.from(missingAssociationTerms.values());
  for (let index = 0; index < missingTermsToImport.length; index += batchSize) {
    const chunk = missingTermsToImport.slice(index, index + batchSize);
    report(
      input,
      `Database import: association-only phenotype terms ${batchProgressLabel(index, missingTermsToImport.length, batchSize)}.`,
    );
    await prisma.$transaction(
      chunk.map((association) =>
        prisma.phenotypeTerm.upsert({
          where: { hpoId: association.hpoId },
          update: { label: association.hpoLabel ?? association.hpoId },
          create: {
            hpoId: association.hpoId,
            label: association.hpoLabel ?? association.hpoId,
            sourceVersionId: ontologySource.id,
          },
        }),
      ),
    );
  }
  if (missingTermsToImport.length > 0) {
    const missingTermIds = await loadTermIds(
      prisma,
      missingTermsToImport.map((term) => term.hpoId),
      batchSize,
    );
    for (const [hpoId, termId] of missingTermIds) termIdByHpoId.set(hpoId, termId);
  }

  const geneIdBySymbol = await loadGeneIds(
    prisma,
    associationsToImport.map((association) => association.geneSymbol),
    batchSize,
  );

  let associationCount = 0;
  const associationBatchSize = Math.min(batchSize, 1_000);
  const useTargetedAssociationDeletes = associationsToImport.length <= 10_000;
  if (associationsToImport.length > 0 && !useTargetedAssociationDeletes) {
    report(input, "Database import: clearing existing HPO gene-phenotype associations.");
    const hpoAssociationSources = await prisma.dataSourceVersion.findMany({
      where: { sourceName: HPO_SOURCE_NAMES.geneAssociations },
      select: { id: true },
    });
    const sourceIds = hpoAssociationSources.map((source) => source.id);
    if (sourceIds.length > 0) {
      await prisma.genePhenotypeAssociation.deleteMany({
        where: { sourceVersionId: { in: sourceIds } },
      });
    }
  }
  for (let index = 0; index < associationsToImport.length; index += associationBatchSize) {
    const chunk = associationsToImport.slice(index, index + associationBatchSize);
    const rows = chunk.flatMap((association) => {
      const geneId = geneIdBySymbol.get(association.geneSymbol);
      const phenotypeTermId = termIdByHpoId.get(association.hpoId);
      if (!geneId || !phenotypeTermId) return [];
      return [
        {
          geneId,
          phenotypeTermId,
          evidenceCode: nullable(association.evidenceCode),
          evidenceSource: nullable(association.evidenceSource),
          diseaseId: nullable(association.diseaseId),
          diseaseName: nullable(association.diseaseName),
          frequency: nullable(association.frequency),
          onset: nullable(association.onset),
          sex: nullable(association.sex),
          modifier: nullable(association.modifier),
          reference: nullable(association.reference),
          sourceVersionId: associationSource.id,
        },
      ];
    });
    report(
      input,
      "Database import: gene-phenotype associations " +
        batchProgressLabel(index, associationsToImport.length, associationBatchSize) +
        ".",
    );
    if (rows.length === 0) continue;
    if (useTargetedAssociationDeletes) {
      await prisma.$transaction([
        prisma.genePhenotypeAssociation.deleteMany({
          where: {
            OR: rows.map((row) => ({
              geneId: row.geneId,
              phenotypeTermId: row.phenotypeTermId,
              diseaseId: row.diseaseId,
              evidenceSource: row.evidenceSource,
            })),
          },
        }),
        prisma.genePhenotypeAssociation.createMany({ data: rows }),
      ]);
      associationCount += rows.length;
    } else {
      const created = await prisma.genePhenotypeAssociation.createMany({ data: rows });
      associationCount += created.count;
    }
  }

  await prisma.dataSourceVersion.update({
    where: { id: associationSource.id },
    data: {
      metadata: {
        fileHashes: associationHashes,
        importedGeneCount: associationsToImport.length,
        importedUniqueGeneCount: genesToImport.length,
        importedAssociationCount: associationCount,
        availableAssociationCount: merged.associations.length,
        associationImportLimit: associationLimit,
        associationImportLimitApplied: associationsSkipped > 0,
        skippedAssociationCount: associationsSkipped,
        importTimestamp: new Date().toISOString(),
        warnings: merged.warnings,
      },
    },
  });
  report(input, "Database import finished.");

  return {
    terms: ontology.terms.length,
    synonyms: synonyms.length,
    relationships: relationships.length,
    genes: associationsToImport.length,
    associations: associationCount,
    associationsAvailable: merged.associations.length,
    associationsSkipped,
    warnings: ontology.warnings.length + merged.warnings.length,
  };
}
