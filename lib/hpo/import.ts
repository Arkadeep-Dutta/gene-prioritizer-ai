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
  const ontology = await parseOboFile(input.ontologyPath);
  const ontologyChecksum = await sha256File(input.ontologyPath);

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
        importedSynonymCount: ontology.terms.reduce((sum, term) => sum + term.synonyms.length, 0),
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
        importedSynonymCount: ontology.terms.reduce((sum, term) => sum + term.synonyms.length, 0),
        importedRelationshipCount: ontology.relationships.length,
        warnings: ontology.warnings,
      },
    },
  });

  for (let index = 0; index < ontology.terms.length; index += batchSize) {
    const chunk = ontology.terms.slice(index, index + batchSize);
    for (const term of chunk) {
      await prisma.phenotypeTerm.upsert({
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
      });
    }
  }

  const terms = await prisma.phenotypeTerm.findMany({
    where: { hpoId: { in: ontology.terms.map((term) => term.hpoId) } },
    select: { id: true, hpoId: true },
  });
  const termIdByHpoId = new Map(terms.map((term) => [term.hpoId, term.id]));

  let synonymCount = 0;
  for (const term of ontology.terms) {
    const termId = termIdByHpoId.get(term.hpoId);
    if (!termId) continue;
    for (const synonym of term.synonyms) {
      await prisma.phenotypeSynonym.upsert({
        where: { termId_synonym: { termId, synonym: synonym.value } },
        update: { synonymType: synonym.scope, source: synonym.source ?? "hp.obo" },
        create: {
          termId,
          synonym: synonym.value,
          synonymType: synonym.scope,
          source: synonym.source ?? "hp.obo",
        },
      });
      synonymCount += 1;
    }
  }

  let relationshipCount = 0;
  for (const relationship of ontology.relationships) {
    const parentTermId = termIdByHpoId.get(relationship.parentHpoId);
    const childTermId = termIdByHpoId.get(relationship.childHpoId);
    if (!parentTermId || !childTermId) continue;
    await prisma.phenotypeRelationship.upsert({
      where: {
        parentTermId_childTermId_relationshipType: {
          parentTermId,
          childTermId,
          relationshipType: relationship.relationshipType,
        },
      },
      update: {},
      create: { parentTermId, childTermId, relationshipType: relationship.relationshipType },
    });
    relationshipCount += 1;
  }

  const parsedAssociationFiles: ParsedGeneAssociations[] = [];
  const associationHashes: Record<string, string> = {};
  const associationLimit =
    input.associationLimit !== undefined
      ? Math.max(0, Math.floor(input.associationLimit))
      : undefined;
  let remainingAssociationLimit = associationLimit;
  const associationLimitWarnings: string[] = [];

  async function parseAssociationFile(
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

    const parsed = await parseFile(path, { limit: remainingAssociationLimit });
    parsedAssociationFiles.push(parsed);
    associationHashes[basename(path)] = await sha256File(path);
    if (remainingAssociationLimit !== undefined) {
      remainingAssociationLimit = Math.max(
        0,
        remainingAssociationLimit - parsed.associations.length,
      );
    }
  }

  await parseAssociationFile(input.phenotypeToGenesPath, parsePhenotypeToGenesFile);
  await parseAssociationFile(input.genesToPhenotypePath, parseGenesToPhenotypeFile);

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

  let geneCount = 0;
  let associationCount = 0;
  for (let index = 0; index < associationsToImport.length; index += batchSize) {
    const chunk = associationsToImport.slice(index, index + batchSize);
    for (const association of chunk) {
      const gene = await prisma.gene.upsert({
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
        select: { id: true },
      });
      geneCount += 1;

      let termId = termIdByHpoId.get(association.hpoId);
      if (!termId) {
        const term = await prisma.phenotypeTerm.upsert({
          where: { hpoId: association.hpoId },
          update: { label: association.hpoLabel ?? association.hpoId },
          create: {
            hpoId: association.hpoId,
            label: association.hpoLabel ?? association.hpoId,
            sourceVersionId: ontologySource.id,
          },
          select: { id: true },
        });
        termId = term.id;
        termIdByHpoId.set(association.hpoId, term.id);
      }

      const existing = await prisma.genePhenotypeAssociation.findFirst({
        where: {
          geneId: gene.id,
          phenotypeTermId: termId,
          diseaseId: association.diseaseId,
          evidenceSource: association.evidenceSource,
        },
        select: { id: true },
      });

      const data = {
        evidenceCode: association.evidenceCode,
        evidenceSource: association.evidenceSource,
        diseaseId: association.diseaseId,
        diseaseName: association.diseaseName,
        frequency: association.frequency,
        onset: association.onset,
        sex: association.sex,
        modifier: association.modifier,
        reference: association.reference,
        sourceVersionId: associationSource.id,
      };

      if (existing) {
        await prisma.genePhenotypeAssociation.update({ where: { id: existing.id }, data });
      } else {
        await prisma.genePhenotypeAssociation.create({
          data: { geneId: gene.id, phenotypeTermId: termId, ...data },
        });
      }
      associationCount += 1;
    }
  }

  await prisma.dataSourceVersion.update({
    where: { id: associationSource.id },
    data: {
      metadata: {
        fileHashes: associationHashes,
        importedGeneCount: geneCount,
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

  return {
    terms: ontology.terms.length,
    synonyms: synonymCount,
    relationships: relationshipCount,
    genes: geneCount,
    associations: associationCount,
    associationsAvailable: merged.associations.length,
    associationsSkipped,
    warnings: ontology.warnings.length + merged.warnings.length,
  };
}
