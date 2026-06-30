import { NextResponse } from "next/server";

import { okEnvelope } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { adminErrorResponse, verifyAdminRequest } from "@/lib/security/admin";
import { logAuditEvent } from "@/lib/security/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "admin");
  if (limited) return limited;

  const auth = verifyAdminRequest(request);
  if (!auth.ok) {
    await logAuditEvent(prisma, request, "admin.data_update.denied", {
      status: "failure",
      metadata: { code: auth.code },
    });
    return adminErrorResponse(auth);
  }

  await logAuditEvent(prisma, request, "admin.data_update.attempt", {
    actorHash: auth.actorHash,
    status: "attempt",
    metadata: { mode: "manual_cli_required" },
  });

  await logAuditEvent(prisma, request, "admin.data_update.deferred", {
    actorHash: auth.actorHash,
    status: "success",
    metadata: { manualCliRequired: true },
  });

  return NextResponse.json(
    okEnvelope({
      status: "manual_cli_required",
      message:
        "Automated data update is disabled for this prototype. Run npm run data:update from a controlled server environment.",
      allowedActions: ["manual_cli_import"],
      geneCardsScraping: false,
      arbitraryCommandExecution: false,
    }),
  );
}
