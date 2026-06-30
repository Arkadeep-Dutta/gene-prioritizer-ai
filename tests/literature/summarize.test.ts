import { describe, expect, it } from "vitest";

import { summarizeLiteratureRecords } from "@/lib/literature/summarize";
import type { LiteratureConfig } from "@/lib/literature/config";
import type { PubMedArticle } from "@/lib/literature/types";

const config: LiteratureConfig = {
  enabled: true,
  defaultRetmax: 10,
  maxRetmax: 25,
  cacheTtlSeconds: 100,
  maxQueryLength: 500,
  attachToRankingDefault: false,
  rankingBoostMax: 5,
  rankingEnrichedGeneLimit: 5,
  summariesEnabled: false,
  summaryMaxArticles: 5,
};

const article: PubMedArticle = {
  pmid: "12345678",
  doi: null,
  title: "Fixture title",
  abstract: null,
  journal: null,
  publicationYear: null,
  authors: [],
  url: "https://pubmed.ncbi.nlm.nih.gov/12345678/",
  sourceName: "PubMed",
  fetchedAt: "2026-01-01T00:00:00.000Z",
};

describe("literature summarization guard", () => {
  it("returns metadata unchanged when summaries are not requested", () => {
    const result = summarizeLiteratureRecords([article], false, config);

    expect(result.articles).toEqual([article]);
    expect(result.warnings).toEqual([]);
  });

  it("warns instead of summarizing when summaries are disabled", () => {
    const result = summarizeLiteratureRecords([article], true, config);

    expect(result.articles[0].summary).toBeUndefined();
    expect(result.warnings.join(" ")).toContain("disabled");
  });
});
