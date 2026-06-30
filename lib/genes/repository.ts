import type { PrismaClient } from "@prisma/client";

import { generateGeneLinkouts } from "./linkouts";
import type { GeneValidationResult } from "./types";

export const HGNC_SOURCE_NAME = "HGNC";
export const HGNC_SOURCE_VERSION = "rest-api";

const validatedStatuses = ["VALIDATED", "ALIAS_RESOLVED", "PREVIOUS_SYMBOL_RESOLVED"];

export async function getOrCreateHgncSourceVersion(prisma: PrismaClient) {
  return prisma.dataSourceVersion.upsert({
    where: {
      sourceName_version: {
        sourceName: HGNC_SOURCE_NAME,
        version: HGNC_SOURCE_VERSION,
      },
    },
    update: {
      sourceType: "gene_nomenclature",
      url: process.env.HGNC_API_BASE_URL ?? "https://rest.genenames.org",
      importedAt: new Date(),
      metadata: {
        provider: "HGNC",
        accessModel: "REST API",
        secretRequired: false,
      },
    },
    create: {
      sourceName: HGNC_SOURCE_NAME,
      sourceType: "gene_nomenclature",
      version: HGNC_SOURCE_VERSION,
      url: process.env.HGNC_API_BASE_URL ?? "https://rest.genenames.org",
      metadata: {
        provider: "HGNC",
        accessModel: "REST API",
        secretRequired: false,
      },
    },
  });
}

export async function findCachedValidatedGene(prisma: PrismaClient, normalizedSymbol: string) {
  const bySymbol = await prisma.gene.findFirst({
    where: { symbol: normalizedSymbol, isValidated: true },
    include: { aliases: { orderBy: { alias: "asc" } } },
  });
  if (bySymbol) return { gene: bySymbol, matchedField: "symbol" as const, aliasType: null };

  const byAlias = await prisma.geneAlias.findFirst({
    where: { alias: normalizedSymbol, gene: { isValidated: true } },
    include: { gene: { include: { aliases: { orderBy: { alias: "asc" } } } } },
    orderBy: { createdAt: "desc" },
  });
  if (!byAlias) return null;
  return {
    gene: byAlias.gene,
    matchedField:
      byAlias.aliasType === "previous_symbol"
        ? ("prev_symbol" as const)
        : ("alias_symbol" as const),
    aliasType: byAlias.aliasType,
  };
}

export function cachedGeneToValidationResult(
  input: string,
  normalizedInput: string,
  cached: Awaited<ReturnType<typeof findCachedValidatedGene>>,
  extraWarnings: string[] = [],
): GeneValidationResult | null {
  if (!cached) return null;
  const { gene, matchedField } = cached;
  const aliases = gene.aliases
    .filter((alias) => alias.aliasType !== "previous_symbol")
    .map((alias) => alias.alias);
  const previousSymbols = gene.aliases
    .filter((alias) => alias.aliasType === "previous_symbol")
    .map((alias) => alias.alias);

  const status =
    matchedField === "alias_symbol"
      ? "ALIAS_RESOLVED"
      : matchedField === "prev_symbol"
        ? "PREVIOUS_SYMBOL_RESOLVED"
        : "VALIDATED";

  return {
    input,
    normalizedInput,
    status,
    canonicalSymbol: gene.symbol,
    matchedField: matchedField === "symbol" ? "cache" : matchedField,
    hgncId: gene.hgncId,
    name: gene.name,
    entrezId: gene.entrezId,
    ncbiGeneId: gene.ncbiGeneId,
    ensemblId: gene.ensemblId,
    aliases,
    previousSymbols,
    links: generateGeneLinkouts({
      symbol: gene.symbol,
      hgncId: gene.hgncId,
      entrezId: gene.entrezId,
      ncbiGeneId: gene.ncbiGeneId,
      ensemblId: gene.ensemblId,
    }),
    warnings: extraWarnings,
  };
}

export async function upsertValidatedGene(
  prisma: PrismaClient,
  result: GeneValidationResult,
): Promise<void> {
  if (!result.canonicalSymbol || !validatedStatuses.includes(result.status)) return;
  const source = await getOrCreateHgncSourceVersion(prisma);
  const gene = await prisma.gene.upsert({
    where: { symbol: result.canonicalSymbol },
    update: {
      name: result.name,
      hgncId: result.hgncId,
      entrezId: result.entrezId,
      ncbiGeneId: result.ncbiGeneId,
      ensemblId: result.ensemblId,
      isValidated: true,
      validationStatus: result.status,
      sourceVersionId: source.id,
    },
    create: {
      symbol: result.canonicalSymbol,
      name: result.name,
      hgncId: result.hgncId,
      entrezId: result.entrezId,
      ncbiGeneId: result.ncbiGeneId,
      ensemblId: result.ensemblId,
      isValidated: true,
      validationStatus: result.status,
      sourceVersionId: source.id,
    },
    select: { id: true },
  });

  const aliasValues = new Map<string, string>();
  for (const alias of result.aliases) aliasValues.set(alias.toUpperCase(), "alias");
  for (const previous of result.previousSymbols)
    aliasValues.set(previous.toUpperCase(), "previous_symbol");
  if (result.normalizedInput && result.status === "ALIAS_RESOLVED") {
    aliasValues.set(result.normalizedInput, "alias");
  }
  if (result.normalizedInput && result.status === "PREVIOUS_SYMBOL_RESOLVED") {
    aliasValues.set(result.normalizedInput, "previous_symbol");
  }

  for (const [alias, aliasType] of aliasValues.entries()) {
    if (alias === result.canonicalSymbol) continue;
    await prisma.geneAlias.upsert({
      where: { geneId_alias: { geneId: gene.id, alias } },
      update: { aliasType, source: HGNC_SOURCE_NAME },
      create: { geneId: gene.id, alias, aliasType, source: HGNC_SOURCE_NAME },
    });
  }
}

export async function getGeneDetailBySymbolOrAlias(prisma: PrismaClient, normalizedSymbol: string) {
  const gene = await prisma.gene.findFirst({
    where: {
      OR: [{ symbol: normalizedSymbol }, { aliases: { some: { alias: normalizedSymbol } } }],
    },
    include: {
      aliases: { orderBy: { alias: "asc" } },
      phenotypeLinks: {
        take: 25,
        include: {
          phenotypeTerm: {
            select: { hpoId: true, label: true, isObsolete: true },
          },
        },
        orderBy: { phenotypeTerm: { label: "asc" } },
      },
    },
  });
  if (!gene) return null;
  return gene;
}
