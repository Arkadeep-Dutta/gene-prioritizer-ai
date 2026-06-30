import { createHash } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";

import { getGeneCardsImportConfig } from "./config";
import { GeneCardsImportError } from "./errors";
import { parseGeneCardsDelimitedText } from "./parser";
import { LICENSED_GENECARDS_SOURCE_LABEL, type GeneCardsImportInput } from "./types";
import { validateGeneCardsImportRequest } from "./validate-import";

export function hashGeneCardsImportContent(content: string): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

export async function importLicensedGeneCardsFile(
  prisma: PrismaClient,
  input: GeneCardsImportInput,
) {
  const byteLength = new TextEncoder().encode(input.content).byteLength;
  validateGeneCardsImportRequest({
    originalFilename: input.originalFilename,
    byteLength,
    licenseConfirmed: input.licenseConfirmed,
    licenseConfirmationText: input.licenseConfirmationText,
  });
  if (input.content.includes("\u0000")) {
    throw new GeneCardsImportError(
      "GENECARDS_IMPORT_BINARY_UNSUPPORTED",
      "Uploaded GeneCards import file must be a text CSV or TSV file.",
    );
  }

  const parsed = parseGeneCardsDelimitedText(input.content);
  validateGeneCardsImportRequest({
    originalFilename: input.originalFilename,
    byteLength,
    licenseConfirmed: input.licenseConfirmed,
    licenseConfirmationText: input.licenseConfirmationText,
    rowCount: parsed.rows.length + parsed.rejectedRows.length,
  });

  const fileHash = hashGeneCardsImportContent(input.content);
  const existing = await prisma.licensedGeneCardsImport.findFirst({ where: { fileHash } });
  if (existing) {
    throw new GeneCardsImportError(
      "GENECARDS_IMPORT_DUPLICATE",
      "This exact licensed GeneCards file has already been imported.",
      409,
    );
  }

  const config = getGeneCardsImportConfig();
  const importRecord = await prisma.licensedGeneCardsImport.create({
    data: {
      originalFilename: input.originalFilename,
      fileHash,
      uploadedByHash: input.uploadedByHash ?? null,
      licenseConfirmed: input.licenseConfirmed,
      rowCount: parsed.rows.length + parsed.rejectedRows.length,
      metadata: {
        acceptedRowCount: parsed.rows.length,
        rejectedRowCount: parsed.rejectedRows.length,
        rejectedRows: parsed.rejectedRows,
        parserWarnings: parsed.warnings,
        delimiter: parsed.detectedDelimiter,
        headers: parsed.headers,
        sourceLabel: input.sourceLabel?.trim() || LICENSED_GENECARDS_SOURCE_LABEL,
        notes: input.notes ?? null,
        licenseConfirmationText: input.licenseConfirmationText,
        userProvidedLicensedData: true,
        diagnosticEvidence: false,
        modelTrainingAllowed: false,
      } satisfies Prisma.InputJsonObject,
    },
  });

  for (const row of parsed.rows) {
    const gene = await prisma.gene.findUnique({
      where: { symbol: row.symbol },
      select: { id: true },
    });
    await prisma.licensedGeneCardsGeneAnnotation.create({
      data: {
        importId: importRecord.id,
        geneId: gene?.id ?? null,
        symbol: row.symbol,
        fieldsJson: (config.storeRawFields ? row.fields : {}) as Prisma.InputJsonValue,
      },
    });
  }

  return {
    importId: importRecord.id,
    originalFilename: importRecord.originalFilename,
    fileHash,
    rowCount: importRecord.rowCount,
    acceptedRowCount: parsed.rows.length,
    rejectedRowCount: parsed.rejectedRows.length,
    warnings: [
      "Imported annotations are labeled as user-provided licensed GeneCards/GeneALaCart data.",
      "Imported annotations are not diagnostic evidence and do not override HPO/HGNC/PubMed evidence.",
      ...parsed.warnings,
    ],
  };
}
