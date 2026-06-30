import { afterEach, describe, expect, it } from "vitest";

import { middleware } from "@/middleware";
import { buildContentSecurityPolicy } from "@/lib/security/csp";
import { getSecurityHeaders } from "@/lib/security/headers";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("security headers and CSP", () => {
  it("builds core browser hardening headers", () => {
    process.env.SECURITY_HEADERS_ENABLED = "true";
    process.env.CSP_ENABLED = "true";

    const headers = getSecurityHeaders();

    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
  });

  it("applies security headers through middleware", () => {
    const response = middleware();

    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Security-Policy")).toContain("object-src 'none'");
  });

  it("adds HSTS only in production", () => {
    process.env.APP_ENV = "development";
    expect(getSecurityHeaders()["Strict-Transport-Security"]).toBeUndefined();

    process.env.APP_ENV = "production";
    expect(getSecurityHeaders()["Strict-Transport-Security"]).toContain("max-age=31536000");
  });

  it("uses a restrictive CSP without secrets", () => {
    process.env.TRUSTED_ORIGINS = "https://example.org";
    const csp = buildContentSecurityPolicy();

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("https://eutils.ncbi.nlm.nih.gov");
    expect(csp).not.toContain("ADMIN_INGEST_SECRET");
  });
});
