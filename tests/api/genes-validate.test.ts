import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/genes/validate/route";
import { prisma } from "@/lib/db/prisma";

afterEach(async () => {
  vi.restoreAllMocks();
  delete process.env.GENE_VALIDATION_BATCH_LIMIT;
  await prisma.gene.deleteMany({ where: { symbol: { in: ["PHASE4FAILAPI"] } } });
});

function postJson(body: unknown) {
  return POST(
    new Request("http://localhost/api/genes/validate", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("POST /api/genes/validate", () => {
  it("validates an array of genes from local cache", async () => {
    const response = await postJson({ genes: ["scn2a", "KCNQ2"] });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ normalizedInput: "SCN2A", status: "VALIDATED" }),
        expect.objectContaining({ normalizedInput: "KCNQ2", status: "VALIDATED" }),
      ]),
    );
    expect(body.data.summary.validated).toBeGreaterThanOrEqual(2);
  });

  it("validates genesText input", async () => {
    const response = await postJson({ genesText: "SCN2A, CACNA1A\nKCNQ2" });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.results).toHaveLength(3);
  });

  it("rejects missing input, too many genes, and unsafe symbols", async () => {
    const missing = await postJson({});
    expect(missing.status).toBe(400);

    process.env.GENE_VALIDATION_BATCH_LIMIT = "1";
    const tooMany = await postJson({ genes: ["SCN2A", "KCNQ2"] });
    expect(tooMany.status).toBe(413);

    const unsafe = await postJson({ genes: ["SCN2A<script>"] });
    expect(unsafe.status).toBe(400);
  });

  it("returns UNVALIDATED, not VALIDATED, when HGNC is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network unavailable"));

    const response = await postJson({ genes: ["PHASE4FAILAPI"] });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.results[0]).toMatchObject({
      status: "UNVALIDATED",
      canonicalSymbol: "PHASE4FAILAPI",
    });
    expect(JSON.stringify(body)).not.toContain("DATABASE_URL");
    expect(JSON.stringify(body)).not.toContain("network unavailable");
  });
});
