import { describe, expect, it } from "vitest";

import {
  isPlausibleGeneSymbol,
  normalizeGeneSymbol,
  normalizeGeneSymbolList,
  parseGeneSymbolInput,
} from "@/lib/genes/normalize";

describe("gene symbol normalization", () => {
  it("trims and uppercases plausible symbols", () => {
    expect(normalizeGeneSymbol(" SCN2A ")).toBe("SCN2A");
    expect(normalizeGeneSymbol("scn2a")).toBe("SCN2A");
  });

  it("deduplicates arrays and comma/newline separated text", () => {
    expect(normalizeGeneSymbolList(["scn2a", "SCN2A", "kcnq2"])).toEqual(["SCN2A", "KCNQ2"]);
    expect(normalizeGeneSymbolList("SCN2A, CACNA1A\nKCNQ2")).toEqual(["SCN2A", "CACNA1A", "KCNQ2"]);
  });

  it("rejects empty, unsafe, and too-long inputs", () => {
    expect(normalizeGeneSymbol("")).toBeNull();
    expect(normalizeGeneSymbol("SCN2A<script>")).toBeNull();
    expect(normalizeGeneSymbol("this is a long random paragraph and not a symbol")).toBeNull();
    expect(isPlausibleGeneSymbol("A-B.1")).toBe(true);
    expect(isPlausibleGeneSymbol("A/B")).toBe(false);
  });

  it("preserves original input when parsing", () => {
    expect(parseGeneSymbolInput(" scn2a, SCN2A\nbad/input ")).toEqual([
      { original: "scn2a", normalized: "SCN2A", validFormat: true },
      { original: "bad/input", normalized: null, validFormat: false },
    ]);
  });
});
