import type { PrismaClient } from "@prisma/client";

import type { HpoSearchResult } from "./types";
import { assertValidHpoId, normalizeHpoId } from "./validate";

export async function findTermByHpoId(prisma: PrismaClient, hpoId: string) {
  return prisma.phenotypeTerm.findUnique({
    where: { hpoId: assertValidHpoId(hpoId) },
    include: { synonyms: { orderBy: { synonym: "asc" } } },
  });
}

export async function getTermWithRelationships(prisma: PrismaClient, hpoId: string) {
  return prisma.phenotypeTerm.findUnique({
    where: { hpoId: assertValidHpoId(hpoId) },
    include: {
      synonyms: { orderBy: { synonym: "asc" } },
      parentRelations: {
        include: { childTerm: { select: { hpoId: true, label: true } } },
        orderBy: { childTerm: { label: "asc" } },
      },
      childRelations: {
        include: { parentTerm: { select: { hpoId: true, label: true } } },
        orderBy: { parentTerm: { label: "asc" } },
      },
      _count: { select: { geneAssociations: true } },
      geneAssociations: {
        take: 10,
        include: { gene: { select: { symbol: true, name: true, validationStatus: true } } },
        orderBy: { gene: { symbol: "asc" } },
      },
    },
  });
}

export async function getGenesForHpoTerm(
  prisma: PrismaClient,
  hpoId: string,
  options: { limit?: number } = {},
) {
  const term = await prisma.phenotypeTerm.findUnique({
    where: { hpoId: assertValidHpoId(hpoId) },
    select: { id: true },
  });
  if (!term) return [];
  return prisma.genePhenotypeAssociation.findMany({
    where: { phenotypeTermId: term.id },
    take: Math.min(Math.max(options.limit ?? 25, 1), 100),
    include: { gene: { select: { symbol: true, name: true, validationStatus: true } } },
    orderBy: { gene: { symbol: "asc" } },
  });
}

export async function getPhenotypesForGene(
  prisma: PrismaClient,
  symbol: string,
  options: { limit?: number } = {},
) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const gene = await prisma.gene.findUnique({
    where: { symbol: normalizedSymbol },
    select: { id: true },
  });
  if (!gene) return [];
  return prisma.genePhenotypeAssociation.findMany({
    where: { geneId: gene.id },
    take: Math.min(Math.max(options.limit ?? 25, 1), 100),
    include: { phenotypeTerm: { select: { hpoId: true, label: true, isObsolete: true } } },
    orderBy: { phenotypeTerm: { label: "asc" } },
  });
}

export async function getDataSourceVersions(prisma: PrismaClient) {
  return prisma.dataSourceVersion.findMany({
    orderBy: [{ sourceName: "asc" }, { importedAt: "desc" }],
    select: {
      sourceName: true,
      sourceType: true,
      version: true,
      checksum: true,
      downloadedAt: true,
      importedAt: true,
      metadata: true,
    },
  });
}

export function toHpoSearchResult(term: {
  hpoId: string;
  label: string;
  definition: string | null;
  isObsolete: boolean;
  synonyms: { synonym: string }[];
}): HpoSearchResult {
  return {
    hpoId: term.hpoId,
    label: term.label,
    definition: term.definition,
    synonyms: term.synonyms.map((synonym) => synonym.synonym),
    isObsolete: term.isObsolete,
    score: 0,
  };
}

export function isExactHpoLookup(query: string): boolean {
  return normalizeHpoId(query) !== null;
}
