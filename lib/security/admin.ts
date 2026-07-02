import { timingSafeEqual } from "node:crypto";

import { errorEnvelope } from "@/lib/api/response";

import { getAppEnvironment } from "./config";
import { hashIdentifier } from "./redact";

const DEFAULT_ADMIN_SECRET = "change-me-in-production";

function getProvidedSecret(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }
  return request.headers.get("x-admin-secret")?.trim() ?? "";
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export type AdminAuthResult =
  | { ok: true; actorHash: string | null }
  | { ok: false; status: number; code: string; message: string };

export function verifyAdminRequest(request: Request): AdminAuthResult {
  const configuredSecret = process.env.ADMIN_INGEST_SECRET || DEFAULT_ADMIN_SECRET;
  const isDefaultSecret = configuredSecret === DEFAULT_ADMIN_SECRET;

  if (getAppEnvironment() === "production" && (!configuredSecret || isDefaultSecret)) {
    return {
      ok: false,
      status: 503,
      code: "ADMIN_SECRET_NOT_CONFIGURED",
      message: "Admin endpoints are not configured.",
    };
  }

  const providedSecret = getProvidedSecret(request);
  if (!providedSecret || !safeEqual(providedSecret, configuredSecret)) {
    return {
      ok: false,
      status: 401,
      code: "ADMIN_UNAUTHORIZED",
      message: "Admin authorization is required.",
    };
  }

  return { ok: true, actorHash: hashIdentifier("admin") };
}

export function adminErrorResponse(result: Exclude<AdminAuthResult, { ok: true }>): Response {
  return Response.json(errorEnvelope({}, result.code, result.message), { status: result.status });
}
