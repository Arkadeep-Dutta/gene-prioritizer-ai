import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/literature/search/route";
import { prisma } from "@/lib/db/prisma";
import { clearLiteratureQueryCache } from "@/lib/literature/cache";
import { NcbiClient } from "@/lib/literature/ncbi-client";
import type { PubMedArticle } from "@/lib/literature/types";

const article: PubMedArticle = {
  pmid: "55555555",
  doi: "10.1000/api-fixture",
  title: "API fixture PubMed citation",
  abstract: "Fixture abstract",
  journal: "Fixture Journal",
  publicationYear: 2023,
  authors: ["Fixture Author"],
  url: "https://pubmed.ncbi.nlm.nih.gov/55555555/",
  sourceName: "PubMed",
  fetchedAt: "2026-01-01T00:00:00.000Z",
};

function postJson(body: unknown) {
  return POST(
    new Request("http://localhost/api/literature/search", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

beforeEach(() => {
  clearLiteratureQueryCache();
  vi.spyOn(NcbiClient.prototype, "searchPubMedIds").mockResolvedValue([article.pmid]);
  vi.spyOn(NcbiClient.prototype, "fetchPubMedSummaries").mockResolvedValue([article]);
  vi.spyOn(NcbiClient.prototype, "fetchPubMedDetails").mockResolvedValue([article]);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await prisma.literatureRecord.deleteMany({ where: { pmid: article.pmid } });
});

describe("POST /api/literature/search", () => {
  it("works with one gene and HPO terms", async () => {
    const response = await postJson({
      geneSymbol: "SCN2A",
      hpoTerms: ["HP:0001250"],
      retmax: 5,
      includeAbstracts: true,
      summarize: false,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.records[0].pmid).toBe(article.pmid);
    expect(body.data.queries[0].query).toContain('"SCN2A"[Title/Abstract]');
  });

  it("works with multiple genes", async () => {
    const response = await postJson({
      geneSymbols: ["SCN2A", "KCNQ2"],
      hpoTerms: ["HP:0001250"],
      retmax: 5,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.queries.map((query: { geneSymbol: string }) => query.geneSymbol)).toEqual([
      "SCN2A",
      "SCN2A",
      "KCNQ2",
      "KCNQ2",
    ]);
  });

  it("rejects invalid gene input and too many genes", async () => {
    const invalid = await postJson({ geneSymbol: "BAD<script>" });
    const tooMany = await postJson({
      geneSymbols: Array.from({ length: 26 }, (_, i) => `GENE${i}`),
    });

    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error.code).toBe("GENE_SYMBOL_INVALID");
    expect(tooMany.status).toBe(400);
    expect((await tooMany.json()).error.code).toBe("LITERATURE_SEARCH_REQUEST_INVALID");
  });

  it("caps retmax before NCBI search", async () => {
    await postJson({ geneSymbol: "SCN2A", retmax: 999 });

    expect(NcbiClient.prototype.searchPubMedIds).toHaveBeenCalledWith(expect.any(String), 25);
  });

  it("handles NCBI no results and unavailable responses", async () => {
    vi.mocked(NcbiClient.prototype.searchPubMedIds).mockResolvedValueOnce([]);
    const noResults = await postJson({ geneSymbol: "SCN2A" });
    expect((await noResults.json()).warnings.join(" ")).toContain("No PubMed records found");

    clearLiteratureQueryCache();
    vi.mocked(NcbiClient.prototype.searchPubMedIds).mockRejectedValueOnce(new Error("boom"));
    const unavailable = await postJson({ geneSymbol: "SCN2A" });
    const body = await unavailable.json();
    expect(unavailable.status).toBe(502);
    expect(JSON.stringify(body)).not.toContain("boom");
    expect(JSON.stringify(body)).not.toContain("DATABASE_URL");
  });

  it("rejects raw clinical text and arbitrary PubMed query fields", async () => {
    const freeText = await postJson({ geneSymbol: "SCN2A", freeText: "patient has seizures" });
    const rawQuery = await postJson({ query: '"SCN2A"[All Fields]' });

    expect(freeText.status).toBe(400);
    expect(rawQuery.status).toBe(400);
  });

  it("warns when summaries are requested but disabled", async () => {
    const response = await postJson({ geneSymbol: "SCN2A", summarize: true });
    const body = await response.json();

    expect(body.warnings.join(" ")).toContain("disabled");
    expect(body.data.records[0].summary).toBeUndefined();
  });
});
