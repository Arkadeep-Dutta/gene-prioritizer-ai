import { afterEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/admin/data/update/route";
import { prisma } from "@/lib/db/prisma";

const originalEnv = { ...process.env };

function updateRequest(secret?: string) {
  return new Request("http://localhost/api/admin/data/update", {
    method: "POST",
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  });
}

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("POST /api/admin/data/update", () => {
  it("requires an admin secret", async () => {
    process.env.ADMIN_INGEST_SECRET = "test-admin-secret";

    const response = await POST(updateRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("ADMIN_UNAUTHORIZED");
  });

  it("returns a safe manual update response and logs audit events", async () => {
    process.env.ADMIN_INGEST_SECRET = "test-admin-secret";
    const before = await prisma.auditEvent.count();

    const response = await POST(updateRequest("test-admin-secret"));
    const body = await response.json();
    const after = await prisma.auditEvent.count();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("manual_cli_required");
    expect(body.data.arbitraryCommandExecution).toBe(false);
    expect(body.data.geneCardsScraping).toBe(false);
    expect(after).toBeGreaterThanOrEqual(before + 2);
    expect(JSON.stringify(body)).not.toContain("test-admin-secret");
  });
});
