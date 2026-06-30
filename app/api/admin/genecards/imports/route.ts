import { NextResponse } from "next/server";

import { errorEnvelope, okEnvelope } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { listGeneCardsImports } from "@/lib/genecards/repository";
import { adminErrorResponse, verifyAdminRequest } from "@/lib/security/admin";
import { logAuditEvent } from "@/lib/security/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, "admin");
  if (limited) return limited;

  const auth = verifyAdminRequest(request);
  if (!auth.ok) {
    await logAuditEvent(prisma, request, "genecards.imports.denied", {
      status: "failure",
      metadata: { code: auth.code },
    });
    return adminErrorResponse(auth);
  }

  try {
    const imports = await listGeneCardsImports(prisma);
    await logAuditEvent(prisma, request, "genecards.imports.list", {
      actorHash: auth.actorHash,
      status: "success",
      metadata: { count: imports.length },
    });
    return NextResponse.json(
      okEnvelope({
        imports: imports.map((record) => ({
          importId: record.id,
          originalFilename: record.originalFilename,
          fileHash: record.fileHash,
          fileHashPrefix: record.fileHash.slice(0, 19),
          licenseConfirmed: record.licenseConfirmed,
          importedAt: record.importedAt,
          rowCount: record.rowCount,
          metadata: record.metadata,
          hasAnnotations: record.annotations.length > 0,
        })),
      }),
    );
  } catch {
    return NextResponse.json(
      errorEnvelope({ imports: [] }, "GENECARDS_IMPORTS_UNAVAILABLE", "Unable to list imports."),
      { status: 500 },
    );
  }
}
