import { describe, expect, it } from "vitest";

import { createCsvReport } from "@/lib/export/csv";
import { createJsonReport } from "@/lib/export/json";
import { createMarkdownReport } from "@/lib/export/markdown";
import type { ReportExportInput } from "@/lib/export/types";

import { rankedGene } from "../fixtures/ui";

const reportInput: ReportExportInput = {
  timestamp: "2026-06-24T00:00:00.000Z",
  appVersion: "0.1.0",
  build: {
    appVersion: "0.1.0",
    buildCommitSha: "abc123",
    buildTime: "2026-06-30T00:00:00.000Z",
    deploymentTarget: "test",
  },
  rawText: "Sensitive synthetic free text that should not be exported by default.",
  inputSummary: {
    inputMode: "free_text",
    hpoTermCount: 1,
    candidateGeneCount: 1,
  },
  confirmedHpoTerms: [{ hpoId: "HP:0001250", label: "Seizure" }],
  candidateGenes: [{ input: "SCN2A", canonicalSymbol: "SCN2A", status: "VALIDATED" }],
  rankingMode: "CANDIDATE_BOOSTED",
  algorithmVersion: "fixture-v1",
  dataSourceVersions: { SyntheticFixture: { version: "test" } },
  rankedResults: [rankedGene],
  warnings: ["Synthetic warning"],
  literatureIncluded: true,
};

describe("report exports", () => {
  it("creates JSON report metadata and excludes raw free text by default", () => {
    const report = createJsonReport(reportInput);

    expect(report.generatedAt).toBe("2026-06-24T00:00:00.000Z");
    expect(report.rawText).toBeUndefined();
    expect(report.inputSummary.rawTextIncluded).toBe(false);
    expect(report.disclaimer).toContain("Not a diagnosis");
  });

  it("creates CSV with expected columns and escaping", () => {
    const csv = createCsvReport({
      rankedResults: [
        {
          ...rankedGene,
          gene: { ...rankedGene.gene, name: 'Gene with "quotes", comma' },
        },
      ],
    });

    expect(csv).toContain("rank,geneSymbol,geneName,score");
    expect(csv).toContain('"Gene with ""quotes"", comma"');
    expect(csv).toContain("12345678");
  });

  it("creates Markdown report with disclaimer, HPO terms, genes, and PubMed citations", () => {
    const licensedReport: ReportExportInput = {
      ...reportInput,
      rankedResults: [
        {
          ...rankedGene,
          gene: {
            ...rankedGene.gene,
            licensedGeneCardsAnnotations: [
              {
                symbol: "SCN2A",
                sourceLabel: "Licensed GeneCards/GeneALaCart user-provided import",
                userProvidedLicensedData: true,
                importId: "import_1",
                importedAt: "2026-06-29T00:00:00.000Z",
                fields: { "Synthetic Field": "Synthetic value" },
                warning:
                  "These annotations are imported from a user-provided licensed file and are not diagnostic evidence.",
              },
            ],
          },
        },
      ],
    };
    const markdown = createMarkdownReport(licensedReport);

    expect(markdown).toContain("# Gene Prioritizer AI Report");
    expect(markdown).toContain("App version: 0.1.0");
    expect(markdown).toContain("Build commit: abc123");
    expect(markdown).toContain("Build time: 2026-06-30T00:00:00.000Z");
    expect(markdown).toContain("Research and educational use only");
    expect(markdown).toContain("HP:0001250");
    expect(markdown).toContain("SCN2A");
    expect(markdown).toContain("PMID 12345678");
    expect(markdown).toContain("Raw clinical text included: no");
    expect(markdown).toContain("Licensed GeneCards/GeneALaCart annotations");
    expect(markdown).toContain("not diagnostic evidence");
  });
});
