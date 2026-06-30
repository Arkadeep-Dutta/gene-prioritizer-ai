import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/genes/[symbol]/route";

describe("GET /api/genes/[symbol]", () => {
  it("returns local gene metadata and associated HPO phenotypes", async () => {
    const response = await GET(new Request("http://localhost/api/genes/SCN2A"), {
      params: Promise.resolve({ symbol: "SCN2A" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      symbol: "SCN2A",
      validationStatus: "VALIDATED",
      links: expect.objectContaining({
        clinVarSearch: expect.stringContaining("SCN2A"),
        pubMedSearch: expect.stringContaining("SCN2A"),
        geneCards: expect.stringContaining("genecards.org"),
      }),
    });
    expect(body.data.associatedPhenotypes).toEqual(
      expect.arrayContaining([expect.objectContaining({ hpoId: "HP:0001250" })]),
    );
  });

  it("handles URL encoding and unknown genes safely", async () => {
    const unknown = await GET(new Request("http://localhost/api/genes/NOTFOUND4"), {
      params: Promise.resolve({ symbol: "NOTFOUND4" }),
    });
    const body = await unknown.json();

    expect(unknown.status).toBe(404);
    expect(body).toMatchObject({ ok: false, error: { code: "GENE_NOT_FOUND" } });
    expect(JSON.stringify(body)).not.toContain("DATABASE_URL");
  });
});
