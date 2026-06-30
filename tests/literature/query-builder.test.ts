import { describe, expect, it } from "vitest";

import { buildPubMedQuery } from "@/lib/literature/query-builder";

describe("PubMed query builder", () => {
  it("builds a gene-only query", () => {
    expect(buildPubMedQuery({ geneSymbol: "SCN2A", geneOnly: true }).query).toBe(
      '"SCN2A"[Title/Abstract]',
    );
  });

  it("builds a gene + phenotype query", () => {
    const query = buildPubMedQuery({
      geneSymbol: "SCN2A",
      hpoTerms: [{ hpoId: "HP:0001250", label: "Seizure" }],
    });

    expect(query.query).toBe('"SCN2A"[Title/Abstract] AND ("Seizure"[Title/Abstract])');
    expect(query.queryType).toBe("gene_phenotype");
    expect(query.hpoTerms).toEqual(["HP:0001250"]);
  });

  it("handles multiple HPO terms and caps the count", () => {
    const query = buildPubMedQuery({
      geneSymbol: "SCN2A",
      maxPhenotypeTerms: 2,
      hpoTerms: [
        { hpoId: "HP:0001250", label: "Seizure" },
        { hpoId: "HP:0001263", label: "Global developmental delay" },
        { hpoId: "HP:0001252", label: "Hypotonia" },
      ],
    });

    expect(query.hpoTerms).toEqual(["HP:0001250", "HP:0001263"]);
    expect(query.query).toContain(" OR ");
    expect(query.query).not.toContain("Hypotonia");
  });

  it("sanitizes PubMed syntax injection characters", () => {
    const query = buildPubMedQuery({
      geneSymbol: "SCN2A",
      hpoTerms: [{ hpoId: "HP:0001250", label: 'Seizure") OR "anything' }],
    });

    expect(query.query).not.toContain('OR "anything');
    expect(query.query).not.toContain(" OR ");
    expect(query.query).toContain("(");
  });

  it("caps query length", () => {
    const query = buildPubMedQuery(
      {
        geneSymbol: "SCN2A",
        hpoTerms: [{ hpoId: "HP:0001250", label: "x".repeat(200) }],
      },
      {
        enabled: true,
        defaultRetmax: 10,
        maxRetmax: 25,
        cacheTtlSeconds: 100,
        maxQueryLength: 60,
        attachToRankingDefault: false,
        rankingBoostMax: 5,
        rankingEnrichedGeneLimit: 5,
        summariesEnabled: false,
        summaryMaxArticles: 5,
      },
    );

    expect(query.query.length).toBeLessThanOrEqual(60);
  });

  it("rejects an empty gene", () => {
    expect(() => buildPubMedQuery({ geneSymbol: "" })).toThrow("valid gene symbol");
  });
});
