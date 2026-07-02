import { NextResponse } from "next/server";

import { errorEnvelope } from "@/lib/api/response";

import { getRateLimitConfig } from "./config";
import { getClientIp, hashIdentifier } from "./redact";

export type RateLimitCategory =
  | "default"
  | "prioritize"
  | "phenotypeExtract"
  | "literature"
  | "geneValidate"
  | "admin";

type Bucket = {
  count: number;
  resetAt: number;
};

const memoryBuckets = new Map<string, Bucket>();

function getLimit(category: RateLimitCategory): number {
  const config = getRateLimitConfig();
  switch (category) {
    case "prioritize":
      return config.prioritizeMaxRequests;
    case "phenotypeExtract":
      return config.phenotypeExtractMaxRequests;
    case "literature":
      return config.literatureMaxRequests;
    case "geneValidate":
      return config.geneValidateMaxRequests;
    case "admin":
      return config.adminMaxRequests;
    default:
      return config.defaultMaxRequests;
  }
}

export function resetRateLimitForTests() {
  memoryBuckets.clear();
}

export function checkRateLimit(
  request: Request,
  category: RateLimitCategory,
): { allowed: boolean; limit: number; remaining: number; retryAfter: number; keyHash: string } {
  const config = getRateLimitConfig();
  const limit = getLimit(category);
  const keyHash = hashIdentifier(`${category}:${getClientIp(request)}`) ?? "unknown";
  const now = Date.now();
  const windowMs = config.windowSeconds * 1_000;

  if (!config.enabled) {
    return { allowed: true, limit, remaining: limit, retryAfter: 0, keyHash };
  }

  const bucketKey = `${category}:${keyHash}`;
  const current = memoryBuckets.get(bucketKey);
  const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };
  bucket.count += 1;
  memoryBuckets.set(bucketKey, bucket);

  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000));
  const remaining = Math.max(0, limit - bucket.count);
  return { allowed: bucket.count <= limit, limit, remaining, retryAfter, keyHash };
}

export function rateLimitResponse(retryAfter: number): NextResponse {
  const response = NextResponse.json(
    errorEnvelope({}, "RATE_LIMITED", "Too many requests. Please wait before trying again.", [], {
      retryAfter,
    }),
    { status: 429 },
  );
  response.headers.set("Retry-After", String(retryAfter));
  return response;
}

export function enforceRateLimit(
  request: Request,
  category: RateLimitCategory,
): NextResponse | null {
  const result = checkRateLimit(request, category);
  if (result.allowed) return null;
  return rateLimitResponse(result.retryAfter);
}
