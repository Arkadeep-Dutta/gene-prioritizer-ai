import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { getAncestors, matchGenePhenotypes } from "@/lib/ranking/match-phenotypes";
import type { GenePhenotypeForRanking } from "@/lib/ranking/types";

const inputTerms = [{ hpoId: "HP:0001250", label: "Seizure", isObsolete: false }];
const evidence = {
  evidenceSource: "SyntheticFixture",
  evidenceCode: "DEMO",
  diseaseId: null,
  diseaseName: null,
  frequency: null,
  onset: null,
  reference: null,
};

function association(hpoId: string, label = hpoId): GenePhenotypeForRanking {
  return {
    geneId: "gene",
    symbol: "TEST",
    name: null,
    hgncId: null,
    entrezId: null,
    ncbiGeneId: null,
    ensemblId: null,
    validationStatus: "VALIDATED",
    isValidated: true,
    phenotype: { hpoId, label, isObsolete: false },
    evidence,
  };
}

describe("phenotype matching", () => {
  it("detects exact HPO matches and does not inflate duplicate input terms", () => {
    const matches = matchGenePhenotypes(
      [...inputTerms, ...inputTerms],
      [association("HP:0001250", "Seizure")],
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ matchType: "EXACT", matchedHpoId: "HP:0001250" });
  });

  it("detects ancestor matches using fixture relationships", async () => {
    const ancestors = await getAncestors(prisma, "HP:0001250", 3);
    const matches = matchGenePhenotypes(
      inputTerms,
      [association("HP:0000001", "All")],
      new Map([["HP:0001250", ancestors]]),
    );

    expect(ancestors.get("HP:0000001")).toBe(1);
    expect(matches[0]).toMatchObject({ matchType: "ANCESTOR", matchedHpoId: "HP:0000001" });
  });

  it("handles no match and max depth without unbounded traversal", async () => {
    expect(matchGenePhenotypes(inputTerms, [association("HP:0001627")])).toEqual([]);
    expect(await getAncestors(prisma, "HP:0001250", 0)).toEqual(new Map());
  });
});
