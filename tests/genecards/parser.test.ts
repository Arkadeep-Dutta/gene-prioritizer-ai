import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { GeneCardsImportError } from "@/lib/genecards/errors";
import { parseGeneCardsDelimitedText } from "@/lib/genecards/parser";

function fixture(name: string): string {
  return readFileSync(resolve(process.cwd(), "tests/fixtures/genecards", name), "utf8");
}

describe("GeneCards licensed CSV/TSV parser", () => {
  it("parses synthetic CSV, quoted commas, duplicate symbols, formulas, and patient-like headers", () => {
    const parsed = parseGeneCardsDelimitedText(fixture("licensed-export.fixture.csv"));

    expect(parsed.detectedDelimiter).toBe("csv");
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows.map((row) => row.symbol)).toEqual(["SCN2A", "KCNQ2", "SCN2A"]);
    expect(parsed.rows[0].fields["Synthetic Relevance"]).toBe("alpha, beta");
    expect(parsed.rows[0].fields["Synthetic Note"]).toMatch(/^'/);
    expect(parsed.rows[0].fields.patient_name).toBeUndefined();
    expect(parsed.rows[0].warnings.join(" ")).toContain("inert text");
    expect(parsed.warnings.join(" ")).toContain("Potential patient-identifying columns");
  });

  it("parses synthetic TSV and keeps unknown symbols as symbol-only annotations", () => {
    const parsed = parseGeneCardsDelimitedText(fixture("licensed-export.fixture.tsv"));

    expect(parsed.detectedDelimiter).toBe("tsv");
    expect(parsed.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ symbol: "SCN2A" }),
        expect.objectContaining({ symbol: "UNKNOWN1" }),
      ]),
    );
  });

  it("rejects empty files and files without a gene symbol column", () => {
    expect(() => parseGeneCardsDelimitedText("")).toThrow(GeneCardsImportError);
    expect(() => parseGeneCardsDelimitedText(fixture("invalid-export.fixture.csv"))).toThrow(
      "GeneCards import requires a gene symbol column.",
    );
  });

  it("rejects rows without usable symbols", () => {
    const parsed = parseGeneCardsDelimitedText("Gene Symbol,Note\n,blank\n@@@,bad\nSCN2A,ok");

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rejectedRows).toHaveLength(2);
  });
});
