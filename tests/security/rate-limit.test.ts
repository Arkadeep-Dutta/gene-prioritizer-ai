import { afterEach, describe, expect, it } from "vitest";

import { checkRateLimit, resetRateLimitForTests } from "@/lib/security/rate-limit";

const originalEnv = { ...process.env };

function requestFor(ip: string) {
  return new Request("http://localhost/api/test", { headers: { "x-forwarded-for": ip } });
}

afterEach(() => {
  process.env = { ...originalEnv };
  resetRateLimitForTests();
});

describe("in-memory rate limiter", () => {
  it("allows requests when disabled", () => {
    process.env.RATE_LIMIT_ENABLED = "false";

    expect(checkRateLimit(requestFor("203.0.113.1"), "literature").allowed).toBe(true);
  });

  it("returns retry metadata when endpoint limit is exceeded", () => {
    process.env.RATE_LIMIT_ENABLED = "true";
    process.env.RATE_LIMIT_WINDOW_SECONDS = "60";
    process.env.RATE_LIMIT_LITERATURE_MAX_REQUESTS = "2";

    expect(checkRateLimit(requestFor("203.0.113.2"), "literature").allowed).toBe(true);
    expect(checkRateLimit(requestFor("203.0.113.2"), "literature").allowed).toBe(true);
    const limited = checkRateLimit(requestFor("203.0.113.2"), "literature");

    expect(limited.allowed).toBe(false);
    expect(limited.limit).toBe(2);
    expect(limited.retryAfter).toBeGreaterThan(0);
    expect(limited.keyHash).not.toContain("203.0.113.2");
  });
});
