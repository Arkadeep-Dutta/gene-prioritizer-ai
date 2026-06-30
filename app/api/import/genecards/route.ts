import { NextResponse } from "next/server";

import { errorEnvelope, okEnvelope } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { GeneCardsImportError } from "@/lib/genecards/errors";
import { importLicensedGeneCardsFile } from "@/lib/genecards/importer";
import { adminErrorResponse, verifyAdminRequest } from "@/lib/security/admin";
import { logAuditEvent } from "@/lib/security/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const emptyData = {
  importId: null,
  originalFilename: null,
  fileHash: null,
  rowCount: 0,
  acceptedRowCount: 0,
  rejectedRowCount: 0,
  warnings: [],
};

function boolField(value: FormDataEntryValue | null): boolean {
  return value === "true" || value === "on" || value === "1";
}

type UploadedFormFile = {
  name: string;
  text: () => Promise<string>;
};

function isUploadedFormFile(value: unknown): value is UploadedFormFile {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof value.name === "string" &&
    "text" in value &&
    typeof value.text === "function"
  );
}

function isGeneCardsImportError(error: unknown): error is GeneCardsImportError {
  return (
    error instanceof GeneCardsImportError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string" &&
      error.code.startsWith("GENECARDS_") &&
      "message" in error &&
      typeof error.message === "string")
  );
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "admin");
  if (limited) return limited;

  const auth = verifyAdminRequest(request);
  if (!auth.ok) {
    await logAuditEvent(prisma, request, "genecards.import.denied", {
      status: "failure",
      metadata: { code: auth.code },
    });
    return adminErrorResponse(auth);
  }

  await logAuditEvent(prisma, request, "genecards.import.attempt", {
    actorHash: auth.actorHash,
    status: "attempt",
  });

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!isUploadedFormFile(file)) {
      throw new GeneCardsImportError(
        "GENECARDS_IMPORT_FILE_REQUIRED",
        "A CSV or TSV file is required.",
      );
    }

    const result = await importLicensedGeneCardsFile(prisma, {
      originalFilename: file.name,
      content: await file.text(),
      licenseConfirmed: boolField(form.get("licenseConfirmed")),
      licenseConfirmationText: String(form.get("licenseConfirmationText") ?? ""),
      sourceLabel: String(form.get("sourceLabel") ?? ""),
      notes: String(form.get("notes") ?? ""),
      uploadedByHash: auth.actorHash,
    });

    await logAuditEvent(prisma, request, "genecards.import.success", {
      actorHash: auth.actorHash,
      status: "success",
      metadata: {
        importId: result.importId,
        originalFilename: result.originalFilename,
        fileHash: result.fileHash,
        rowCount: result.rowCount,
        acceptedRowCount: result.acceptedRowCount,
        rejectedRowCount: result.rejectedRowCount,
      },
    });

    return NextResponse.json(okEnvelope(result, result.warnings));
  } catch (error) {
    if (isGeneCardsImportError(error)) {
      const status = "status" in error && typeof error.status === "number" ? error.status : 400;
      const warnings = "warnings" in error && Array.isArray(error.warnings) ? error.warnings : [];
      await logAuditEvent(prisma, request, "genecards.import.failure", {
        actorHash: auth.actorHash,
        status: "failure",
        metadata: { code: error.code },
      });
      return NextResponse.json(errorEnvelope(emptyData, error.code, error.message, warnings), {
        status,
      });
    }

    await logAuditEvent(prisma, request, "genecards.import.failure", {
      actorHash: auth.actorHash,
      status: "failure",
      metadata: { code: "GENECARDS_IMPORT_FAILED" },
    });
    return NextResponse.json(
      errorEnvelope(
        emptyData,
        "GENECARDS_IMPORT_FAILED",
        "Unable to import licensed GeneCards data.",
      ),
      { status: 400 },
    );
  }
}
