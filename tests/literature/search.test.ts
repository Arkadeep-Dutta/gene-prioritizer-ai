import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { clearLiteratureQueryCache } from "@/lib/literature/cache";
import { searchLiterature } from "@/lib/literature/search";
import type { LiteratureConfig } from "@/lib/literature/config";
import type { PubMedArticle } from "@/lib/literature/types";

const config: LiteratureConfig = {
  enabled: true,
  defaultRetmax: 5,
  maxRetmax: 10,
  cacheTtlSeconds: 86_400,
  maxQueryLength: 500,
  attachToRankingDefault: false,
  rankingBoostMax: 5,
  rankingEnrichedGeneLimit: 5,
  summariesEnabled: false,
  summaryMaxArticles: 5,
};

const article: PubMedArticle = {
  pmid: "66666666",
  doi: null,
  title: "Search service fixture",
  abstract: null,
  journal: "Fixture Journal",
  publicationYear: 2020,
  authors: ["Fixture Author"],
  url: "https://pubmed.ncbi.nlm.nih.gov/66666666/",
  sourceName: "PubMed",
  fetchedAt: new Date().toISOString(),
};

beforeEach(() => {
  clearLiteratureQueryCache();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await prisma.literatureRecord.deleteMany({ where: { pmid: article.pmid } });
});

describe("literature search service", () => {
  it("searches gene + HPO terms, falls back to gene-only, and stores records/evidence", async () => {
    const client = {
      searchPubMedIds: vi.fn().mockResolvedValue([article.pmid]),
      fetchPubMedSummaries: vi.fn().mockResolvedValue([article]),
      fetchPubMedDetails: vi.fn().mockResolvedValue([]),
    };

    const result = await searchLiterature({
      prisma,
      geneSymbols: ["SCN2A"],
      hpoTerms: ["HP:0001250"],
      retmax: 5,
      options: { client, config, includeGeneOnlyFallback: true, storeEvidence: true },
    });

    expect(result.queries.map((query) => query.queryType)).toEqual(["gene_phenotype", "gene_only"]);
    expect(result.records).toHaveLength(1);
    expect(client.searchPubMedIds).toHaveBeenCalledTimes(2);
    expect(await prisma.literatureRecord.count({ where: { pmid: article.pmid } })).toBe(1);
    expect(await prisma.literatureEvidence.count()).toBeGreaterThan(0);
  });

  it("returns a no-results warning", async () => {
    const result = await searchLiterature({
      prisma,
      geneSymbols: ["SCN2A"],
      hpoTerms: ["HP:0001250"],
      options: {
        client: {
          searchPubMedIds: vi.fn().mockResolvedValue([]),
          fetchPubMedSummaries: vi.fn(),
          fetchPubMedDetails: vi.fn(),
        },
        config,
        includeGeneOnlyFallback: false,
      },
    });

    expect(result.records).toEqual([]);
    expect(result.warnings.join(" ")).toContain("No PubMed records found");
  });

  it("reuses query and metadata cache", async () => {
    const client = {
      searchPubMedIds: vi.fn().mockResolvedValue([article.pmid]),
      fetchPubMedSummaries: vi.fn().mockResolvedValue([article]),
      fetchPubMedDetails: vi.fn().mockResolvedValue([]),
    };

    await searchLiterature({
      prisma,
      geneSymbols: ["SCN2A"],
      hpoTerms: ["HP:0001250"],
      options: { client, config, includeGeneOnlyFallback: false },
    });
    await searchLiterature({
      prisma,
      geneSymbols: ["SCN2A"],
      hpoTerms: ["HP:0001250"],
      options: { client, config, includeGeneOnlyFallback: false },
    });

    expect(client.searchPubMedIds).toHaveBeenCalledTimes(1);
    expect(client.fetchPubMedSummaries).toHaveBeenCalledTimes(1);
  });

  it("warns when summaries are requested but disabled", async () => {
    const result = await searchLiterature({
      prisma,
      geneSymbols: ["SCN2A"],
      hpoTerms: ["HP:0001250"],
      summarize: true,
      options: {
        client: {
          searchPubMedIds: vi.fn().mockResolvedValue([article.pmid]),
          fetchPubMedSummaries: vi.fn().mockResolvedValue([article]),
          fetchPubMedDetails: vi.fn().mockResolvedValue([]),
        },
        config,
        includeGeneOnlyFallback: false,
      },
    });

    expect(result.warnings.join(" ")).toContain("disabled");
  });
});
