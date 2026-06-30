import { describe, expect, it } from "vitest";

import { calculateGeneScore, calculateTermSpecificity, scoreLabel } from "@/lib/ranking/scoring";
import type { MatchedPhenotype } from "@/lib/ranking/types";

const evidence = {
  evidenceSource: "HPO",
  evidenceCode: "IEA",
  diseaseId: "OMIM:1",
  diseaseName: "Example disease",
  frequency: null,
  onset: null,
  reference: null,
};

function match(hpoId: string, matchType: "EXACT" | "ANCESTOR", depth = 0): MatchedPhenotype {
  return {
    inputHpoId: hpoId,
    inputLabel: hpoId,
    matchedHpoId: hpoId,
    matchedLabel: hpoId,
    matchType,
    matchDepth: depth,
    associationEvidence: evidence,
  };
}

describe("ranking scoring", () => {
  it("scores exact and multiple exact matches above no match", () => {
    const counts = new Map([["HP:0001250", 1]]);
    const none = calculateGeneScore({
      matches: [],
      inputTermAssociationCounts: counts,
      rankingMode: "ALL_GENES",
      isCandidateGene: false,
      isValidatedGene: true,
      obsoleteInputHpoIds: new Set(),
      hasNoCandidateAssociation: false,
    });
    const one = calculateGeneScore({
      matches: [match("HP:0001250", "EXACT")],
      inputTermAssociationCounts: counts,
      rankingMode: "ALL_GENES",
      isCandidateGene: false,
      isValidatedGene: true,
      obsoleteInputHpoIds: new Set(),
      hasNoCandidateAssociation: false,
    });
    const two = calculateGeneScore({
      matches: [match("HP:0001250", "EXACT"), match("HP:0001263", "EXACT")],
      inputTermAssociationCounts: new Map([
        ["HP:0001250", 1],
        ["HP:0001263", 1],
      ]),
      rankingMode: "ALL_GENES",
      isCandidateGene: false,
      isValidatedGene: true,
      obsoleteInputHpoIds: new Set(),
      hasNoCandidateAssociation: false,
    });

    expect(one.score).toBeGreaterThan(none.score);
    expect(two.score).toBeGreaterThan(one.score);
  });

  it("scores ancestor matches below exact matches and generic terms below specific terms", () => {
    const exact = calculateGeneScore({
      matches: [match("HP:0001250", "EXACT")],
      inputTermAssociationCounts: new Map([["HP:0001250", 1]]),
      rankingMode: "ALL_GENES",
      isCandidateGene: false,
      isValidatedGene: true,
      obsoleteInputHpoIds: new Set(),
      hasNoCandidateAssociation: false,
    });
    const ancestor = calculateGeneScore({
      matches: [match("HP:0001250", "ANCESTOR", 1)],
      inputTermAssociationCounts: new Map([["HP:0001250", 1]]),
      rankingMode: "ALL_GENES",
      isCandidateGene: false,
      isValidatedGene: true,
      obsoleteInputHpoIds: new Set(),
      hasNoCandidateAssociation: false,
    });

    expect(ancestor.score).toBeLessThan(exact.score);
    expect(calculateTermSpecificity(1)).toBeGreaterThan(calculateTermSpecificity(100));
  });

  it("applies candidate boost only in boosted mode, penalties, normalization, and labels", () => {
    const common = {
      matches: [match("HP:0001250", "EXACT")],
      inputTermAssociationCounts: new Map([["HP:0001250", 1]]),
      isCandidateGene: true,
      isValidatedGene: false,
      obsoleteInputHpoIds: new Set<string>(),
      hasNoCandidateAssociation: false,
    };
    const boosted = calculateGeneScore({ ...common, rankingMode: "CANDIDATE_BOOSTED" });
    const unboosted = calculateGeneScore({ ...common, rankingMode: "CANDIDATE_ONLY" });

    expect(boosted.scoreBreakdown.candidateBoost).toBe(5);
    expect(unboosted.scoreBreakdown.candidateBoost).toBe(0);
    expect(boosted.scoreBreakdown.penalties).toBeLessThan(0);
    expect(boosted.score).toBeGreaterThanOrEqual(0);
    expect(boosted.score).toBeLessThanOrEqual(100);
    expect(scoreLabel(85)).toBe("Strong candidate for review");
    expect(scoreLabel(65)).toBe("Moderate candidate for review");
    expect(scoreLabel(40)).toBe("Limited evidence candidate");
    expect(scoreLabel(10)).toBe("Weakly supported candidate");
    expect(scoreLabel(0)).toBe("No local evidence found");
  });
});
