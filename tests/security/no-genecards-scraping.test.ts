import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { escapeSpreadsheetFormula } from "@/lib/genecards/parser";

const sourceFiles = [
  "lib/genecards/config.ts",
  "lib/genecards/linkout.ts",
  "lib/genecards/parser.ts",
  "lib/genecards/importer.ts",
  "lib/genecards/repository.ts",
  "app/api/import/genecards/route.ts",
  "app/api/admin/genecards/imports/route.ts",
  "app/api/admin/genecards/imports/[id]/route.ts",
  "lib/genes/linkouts.ts",
];

function sourceText(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("GeneCards no-scraping guardrails", () => {
  it("does not add GeneCards fetch/crawl/scrape code in import/linkout paths", () => {
    const combined = sourceFiles.map(sourceText).join("\n");

    expect(combined).not.toMatch(/\bfetch\s*\(/);
    expect(combined).not.toMatch(/\baxios\b|\bcheerio\b|\bpuppeteer\b|\bplaywright\b/i);
    expect(combined).not.toMatch(/crawl|scrape|carddisp\.pl.*fetch/i);
    expect(combined).not.toMatch(/http:\/\/www\.genecards\.org/i);
  });

  it("keeps spreadsheet formula-looking values inert", () => {
    expect(escapeSpreadsheetFormula("=cmd|' /C calc'!A0")).toMatch(/^'/);
    expect(escapeSpreadsheetFormula("+SUM(A1:A2)")).toMatch(/^'/);
    expect(escapeSpreadsheetFormula("-1+2")).toMatch(/^'/);
    expect(escapeSpreadsheetFormula("@NOW()")).toMatch(/^'/);
  });

  it("does not seed real GeneCards content in fixtures", () => {
    const csv = sourceText("tests/fixtures/genecards/licensed-export.fixture.csv");
    const tsv = sourceText("tests/fixtures/genecards/licensed-export.fixture.tsv");
    const fixtureText = `${csv}\n${tsv}`;

    expect(fixtureText).toContain("Synthetic");
    expect(fixtureText).not.toMatch(/genecards\.org|carddisp|GeneALaCart export id/i);
    expect(fixtureText).not.toMatch(/mrn|dob|date_of_birth|email|phone|address/i);
  });
});
