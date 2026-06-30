import { Prisma, type PrismaClient } from "@prisma/client";

import { createRequestMeta } from "@/lib/api/response";

import { getSecurityConfig } from "./config";
import { getClientIp, hashIdentifier, safeLogMetadata } from "./redact";

export type AuditStatus = "attempt" | "success" | "failure";

export async function logAuditEvent(
  prisma: PrismaClient,
  request: Request,
  eventType: string,
  options: {
    actorType?: string;
    actorHash?: string | null;
    requestId?: string;
    status?: AuditStatus;
    metadata?: Record<string, unknown>;
  } = {},
) {
  if (!getSecurityConfig().auditAdminActions) return;

  const metadata = safeLogMetadata({
    status: options.status ?? "attempt",
    ...(options.metadata ?? {}),
  });

  try {
    await prisma.auditEvent.create({
      data: {
        eventType,
        actorType: options.actorType ?? "admin",
        actorHash: options.actorHash ?? null,
        ipHash: hashIdentifier(getClientIp(request)),
        userAgent: request.headers.get("user-agent")?.slice(0, 256) ?? null,
        requestId: options.requestId ?? createRequestMeta().requestId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  } catch {
    // Audit logging must not make the admin/status path leak errors or fail open noisily.
  }
}
