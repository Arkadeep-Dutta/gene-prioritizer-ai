import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/prioritize/route";
import { prisma } from "@/lib/db/prisma";
import { clearLiteratureQueryCache } from "@/lib/literature/cache";
import { NcbiClient } from "@/lib/literature/ncbi-client";
import type { PubMedArticle } from "@/lib/literature/types";

function article(pmid: string): PubMedArticle {
  return {
    pmid,
    doi: null,
    title: `Ranking literature fixture ${pmid}`,
    abstract: null,
    journal: "Fixture Journal",
    publicationYear: 2024,
    authors: ["Fixture Author"],
    url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    sourceName: "PubMed",
    fetchedAt: "2026-01-01T00:00:00.000Z",
  };
}

function postJson(body: unknown) {
  return POST(
    new Request("http://localhost/api/prioritize", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

beforeEach(() => {
  clearLiteratureQueryCache();
  process.env.LITERATURE_RANKING_GENE_LIMIT = "2";
});

afterEach(async () => {
  vi.restoreAllMocks();
  delete process.env.LITERATURE_RANKING_GENE_LIMIT;
  await prisma.literatureRecord.deleteMany({
    where: { pmid: { startsWith: "44" } },
  });
});

describe("POST /api/prioritize literature enrichment", () => {
  it("keeps default behavior unchanged when includeLiterature=false", async () => {
    const searchSpy = vi.spyOn(NcbiClient.prototype, "searchPubMedIds");

    const response = await postJson({ hpoTerms: ["HP:0001250"], storeResults: false });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.results[0].scoreBreakdown.literatureBoost).toBe(0);
    expect(body.data.results[0]).not.toHaveProperty("literatureEvidence");
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it("attaches citation-grounded literature evidence when requested", async () => {
    const fixtureArticle = article("44111111");
    vi.spyOn(NcbiClient.prototype, "searchPubMedIds").mockResolvedValue([fixtureArticle.pmid]);
    vi.spyOn(NcbiClient.prototype, "fetchPubMedSummaries").mockResolvedValue([fixtureArticle]);
    vi.spyOn(NcbiClient.prototype, "fetchPubMedDetails").mockResolvedValue([]);

    const response = await postJson({
      hpoTerms: ["HP:0001250", "HP:0001263"],
      candidateGenes: ["SCN2A", "KCNQ2"],
      rankingMode: "CANDIDATE_BOOSTED",
      storeResults: false,
      includeLiterature: true,
      literatureRetmax: 3,
    });
    const body = await response.json();
    const enriched = body.data.results.find(
      (result: { literatureEvidence?: unknown }) => result.literatureEvidence,
    );

    expect(response.status).toBe(200);
    expect(enriched.literatureEvidence.records[0].pmid).toBe(fixtureArticle.pmid);
    expect(enriched.scoreBreakdown.literatureBoost).toBeGreaterThan(0);
    expect(body.data.warnings.join(" ")).toContain("does not prove causality");
  });

  it("keeps literatureBoost at zero when no records are found", async () => {
    vi.spyOn(NcbiClient.prototype, "searchPubMedIds").mockResolvedValue([]);
    vi.spyOn(NcbiClient.prototype, "fetchPubMedSummaries").mockResolvedValue([]);
    vi.spyOn(NcbiClient.prototype, "fetchPubMedDetails").mockResolvedValue([]);

    const response = await postJson({
      hpoTerms: ["HP:0001250"],
      storeResults: false,
      includeLiterature: true,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.results[0].scoreBreakdown.literatureBoost).toBe(0);
    expect(body.data.warnings.join(" ")).toContain("Absence of PubMed results");
  });

  it("caps the literature boost", async () => {
    const records = Array.from({ length: 8 }, (_, index) => article(`44${index}99999`));
    vi.spyOn(NcbiClient.prototype, "searchPubMedIds").mockResolvedValue(
      records.map((record) => record.pmid),
    );
    vi.spyOn(NcbiClient.prototype, "fetchPubMedSummaries").mockResolvedValue(records);
    vi.spyOn(NcbiClient.prototype, "fetchPubMedDetails").mockResolvedValue([]);

    const response = await postJson({
      hpoTerms: ["HP:0001250"],
      storeResults: false,
      includeLiterature: true,
      literatureRetmax: 10,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.results[0].scoreBreakdown.literatureBoost).toBeLessThanOrEqual(5);
  });

  it("degrades gracefully if PubMed fails during ranking enrichment", async () => {
    vi.spyOn(NcbiClient.prototype, "searchPubMedIds").mockRejectedValue(new Error("NCBI down"));

    const response = await postJson({
      hpoTerms: ["HP:0001250"],
      storeResults: false,
      includeLiterature: true,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.results.length).toBeGreaterThan(0);
    expect(body.data.warnings.join(" ")).toContain("enrichment failed");
    expect(JSON.stringify(body)).not.toContain("NCBI down");
  });
});
