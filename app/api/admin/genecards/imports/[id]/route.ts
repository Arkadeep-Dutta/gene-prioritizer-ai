import { NextResponse } from "next/server";

import { errorEnvelope, okEnvelope } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { getGeneCardsImportById } from "@/lib/genecards/repository";
import { adminErrorResponse, verifyAdminRequest } from "@/lib/security/admin";
import { logAuditEvent } from "@/lib/security/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function safeAnnotationSample(annotation: {
  symbol: string;
  fieldsJson: unknown;
  createdAt: Date;
}) {
  const fields =
    annotation.fieldsJson &&
    typeof annotation.fieldsJson === "object" &&
    !Array.isArray(annotation.fieldsJson)
      ? Object.fromEntries(
          Object.entries(annotation.fieldsJson).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : {};

  return {
    symbol: annotation.symbol,
    fieldNames: Object.keys(fields),
    createdAt: annotation.createdAt,
  };
}

export async function GET(request: Request, context: RouteContext) {
  const limited = enforceRateLimit(request, "admin");
  if (limited) return limited;

  const auth = verifyAdminRequest(request);
  if (!auth.ok) {
    await logAuditEvent(prisma, request, "genecards.imports.detail.denied", {
      status: "failure",
      metadata: { code: auth.code },
    });
    return adminErrorResponse(auth);
  }

  const { id } = await context.params;
  const importRecord = await getGeneCardsImportById(prisma, id);
  if (!importRecord) {
    return NextResponse.json(
      errorEnvelope({ import: null }, "GENECARDS_IMPORT_NOT_FOUND", "Import not found."),
      { status: 404 },
    );
  }

  await logAuditEvent(prisma, request, "genecards.imports.detail", {
    actorHash: auth.actorHash,
    status: "success",
    metadata: { importId: importRecord.id },
  });

  return NextResponse.json(
    okEnvelope({
      import: {
        importId: importRecord.id,
        originalFilename: importRecord.originalFilename,
        fileHashPrefix: importRecord.fileHash.slice(0, 19),
        licenseConfirmed: importRecord.licenseConfirmed,
        importedAt: importRecord.importedAt,
        rowCount: importRecord.rowCount,
        metadata: importRecord.metadata,
        annotationSample: importRecord.annotations.map(safeAnnotationSample),
      },
    }),
  );
}
