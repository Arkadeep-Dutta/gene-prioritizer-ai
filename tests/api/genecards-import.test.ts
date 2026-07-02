// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/import/genecards/route";
import { prisma } from "@/lib/db/prisma";

const originalEnv = { ...process.env };

function fixture(name: string): string {
  return readFileSync(resolve(process.cwd(), "tests/fixtures/genecards", name), "utf8");
}

function importRequest(
  secret: string | null,
  fileContent = fixture("licensed-export.fixture.tsv"),
) {
  const form = new FormData();
  form.set(
    "file",
    new File([fileContent], "licensed-export.fixture.tsv", { type: "text/tab-separated-values" }),
  );
  form.set("licenseConfirmed", "true");
  form.set("licenseConfirmationText", "Licensed export confirmed.");

  return new Request("http://localhost/api/import/genecards", {
    method: "POST",
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    body: form,
  });
}

async function cleanImports() {
  await prisma.licensedGeneCardsGeneAnnotation.deleteMany();
  await prisma.licensedGeneCardsImport.deleteMany();
}

afterEach(async () => {
  process.env = { ...originalEnv };
  await cleanImports();
});

describe("POST /api/import/genecards", () => {
  it("requires an admin secret before accepting uploads", async () => {
    process.env.ADMIN_INGEST_SECRET = "test-admin-secret";
    process.env.GENE_CARDS_LICENSED_IMPORT_ENABLED = "true";

    const response = await POST(importRequest(null));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("ADMIN_UNAUTHORIZED");
    expect(JSON.stringify(body)).not.toContain("test-admin-secret");
  });

  it("fails safely when licensed import is disabled", async () => {
    process.env.ADMIN_INGEST_SECRET = "test-admin-secret";
    process.env.GENE_CARDS_LICENSED_IMPORT_ENABLED = "false";

    const response = await POST(importRequest("test-admin-secret"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("GENECARDS_IMPORT_DISABLED");
    expect(JSON.stringify(body)).not.toContain("DATABASE_URL");
  });

  it("imports enabled licensed uploads and writes audit events without raw content", async () => {
    process.env.ADMIN_INGEST_SECRET = "test-admin-secret";
    process.env.GENE_CARDS_LICENSED_IMPORT_ENABLED = "true";
    await cleanImports();
    const beforeAudit = await prisma.auditEvent.count();

    const response = await POST(importRequest("test-admin-secret"));
    const body = await response.json();
    const latestAudits = await prisma.auditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.acceptedRowCount).toBe(2);
    expect(await prisma.auditEvent.count()).toBeGreaterThanOrEqual(beforeAudit + 2);
    expect(latestAudits.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["genecards.import.success", "genecards.import.attempt"]),
    );
    expect(JSON.stringify(latestAudits)).not.toContain("Synthetic TSV annotation");
    expect(JSON.stringify(body)).not.toContain("test-admin-secret");
  });

  it("returns safe errors for invalid and duplicate files", async () => {
    process.env.ADMIN_INGEST_SECRET = "test-admin-secret";
    process.env.GENE_CARDS_LICENSED_IMPORT_ENABLED = "true";
    await cleanImports();

    const invalid = await POST(
      importRequest("test-admin-secret", fixture("invalid-export.fixture.csv")),
    );
    const invalidBody = await invalid.json();
    expect(invalid.status).toBe(400);
    expect(invalidBody.error.code).toBe("GENECARDS_SYMBOL_COLUMN_MISSING");

    await POST(importRequest("test-admin-secret"));
    const duplicate = await POST(importRequest("test-admin-secret"));
    const duplicateBody = await duplicate.json();
    expect(duplicate.status).toBe(409);
    expect(duplicateBody.error.code).toBe("GENECARDS_IMPORT_DUPLICATE");
    expect(JSON.stringify(duplicateBody)).not.toContain("Error:");
  });
});
