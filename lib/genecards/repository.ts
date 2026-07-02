import { Prisma, type PrismaClient } from "@prisma/client";

import { LICENSED_GENECARDS_SOURCE_LABEL, type LicensedGeneCardsAnnotation } from "./types";

function safeFields(fields: Prisma.JsonValue): Record<string, string> {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return {};
  return Object.fromEntries(
    Object.entries(fields).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export async function getLicensedGeneCardsAnnotationsForGene(
  prisma: PrismaClient,
  symbol: string,
  limit = 10,
): Promise<LicensedGeneCardsAnnotation[]> {
  const annotations = await prisma.licensedGeneCardsGeneAnnotation.findMany({
    where: { symbol: symbol.toUpperCase() },
    include: { import: { select: { id: true, importedAt: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return annotations.map((annotation) => ({
    symbol: annotation.symbol,
    sourceLabel: LICENSED_GENECARDS_SOURCE_LABEL,
    userProvidedLicensedData: true,
    importId: annotation.import.id,
    importedAt: annotation.import.importedAt,
    fields: safeFields(annotation.fieldsJson as Prisma.JsonValue),
    warning:
      "These annotations are imported from a user-provided licensed file and are not diagnostic evidence.",
  }));
}

export async function listGeneCardsImports(prisma: PrismaClient, limit = 25) {
  return prisma.licensedGeneCardsImport.findMany({
    orderBy: { importedAt: "desc" },
    take: Math.min(limit, 100),
    select: {
      id: true,
      originalFilename: true,
      fileHash: true,
      licenseConfirmed: true,
      importedAt: true,
      rowCount: true,
      metadata: true,
      annotations: { select: { id: true }, take: 1 },
    },
  });
}

export async function getGeneCardsImportById(prisma: PrismaClient, importId: string) {
  return prisma.licensedGeneCardsImport.findUnique({
    where: { id: importId },
    select: {
      id: true,
      originalFilename: true,
      fileHash: true,
      licenseConfirmed: true,
      importedAt: true,
      rowCount: true,
      metadata: true,
      annotations: {
        select: { symbol: true, fieldsJson: true, createdAt: true },
        take: 25,
        orderBy: { createdAt: "asc" },
      },
    },
  });
}
