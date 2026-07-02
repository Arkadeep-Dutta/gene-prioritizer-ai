import { afterEach, describe, expect, it } from "vitest";

import { GET } from "@/app/api/admin/status/route";
import { prisma } from "@/lib/db/prisma";

const originalEnv = { ...process.env };

function adminRequest(secret?: string) {
  return new Request("http://localhost/api/admin/status", {
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  });
}

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("GET /api/admin/status", () => {
  it("requires an admin secret and returns a safe envelope", async () => {
    process.env.ADMIN_INGEST_SECRET = "test-admin-secret";
    const response = await GET(adminRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("ADMIN_UNAUTHORIZED");
    expect(JSON.stringify(body)).not.toContain("test-admin-secret");
  });

  it("returns safe status with the correct secret", async () => {
    process.env.ADMIN_INGEST_SECRET = "test-admin-secret";
    const response = await GET(adminRequest("test-admin-secret"));
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.database.reachable).toBe(true);
    expect(body.data.hardening).toMatchObject({
      securityHeadersEnabled: expect.any(Boolean),
      cspEnabled: expect.any(Boolean),
    });
    expect(serialized).not.toContain("test-admin-secret");
    expect(serialized).not.toContain("DATABASE_URL");
  });

  it("fails closed with default admin secret in production", async () => {
    process.env.APP_ENV = "production";
    process.env.ADMIN_INGEST_SECRET = "change-me-in-production";

    const response = await GET(adminRequest("change-me-in-production"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("ADMIN_SECRET_NOT_CONFIGURED");
  });

  it("logs denied admin access attempts without storing the secret", async () => {
    process.env.ADMIN_INGEST_SECRET = "test-admin-secret";
    const before = await prisma.auditEvent.count();

    await GET(adminRequest("wrong-secret"));

    const after = await prisma.auditEvent.count();
    const latest = await prisma.auditEvent.findFirst({ orderBy: { createdAt: "desc" } });
    expect(after).toBeGreaterThan(before);
    expect(latest?.eventType).toBe("admin.status.denied");
    expect(JSON.stringify(latest)).not.toContain("wrong-secret");
  });
});
