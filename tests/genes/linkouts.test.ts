import { describe, expect, it, vi } from "vitest";

import { generateGeneLinkouts } from "@/lib/genes/linkouts";

describe("gene linkouts", () => {
  it("generates safe external links without network calls", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const links = generateGeneLinkouts({
      symbol: "SCN2A",
      hgncId: "HGNC:10588",
      entrezId: "6326",
      ensemblId: "ENSG00000136531",
    });

    expect(links.hgnc).toContain("HGNC%3A10588");
    expect(links.ncbiGene).toBe("https://www.ncbi.nlm.nih.gov/gene/6326");
    expect(links.ensembl).toContain("ENSG00000136531");
    expect(links.clinVarSearch).toContain("SCN2A");
    expect(links.pubMedSearch).toContain("SCN2A");
    expect(links.geneCards).toContain("genecards.org");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("omits optional identifier links when identifiers are missing and honors GeneCards disablement", () => {
    const links = generateGeneLinkouts({ symbol: "SCN2A" }, {
      GENE_CARDS_LINKOUT_ENABLED: "false",
    } as unknown as NodeJS.ProcessEnv);

    expect(links.hgnc).toBeUndefined();
    expect(links.ncbiGene).toBeUndefined();
    expect(links.ensembl).toBeUndefined();
    expect(links.geneCards).toBeUndefined();
    expect(links.clinVarSearch).toContain("SCN2A");
    expect(links.pubMedSearch).toContain("SCN2A");
  });
});
