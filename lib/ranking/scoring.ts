import type { MatchedPhenotype, RankingMode, ScoreBreakdown } from "./types";

export function calculateTermSpecificity(associatedGeneCount: number): number {
  if (associatedGeneCount <= 0) return 8;
  return Math.max(0.5, Math.min(8, 8 / Math.sqrt(associatedGeneCount)));
}

export function scoreLabel(score: number): string {
  if (score >= 80) return "Strong candidate for review";
  if (score >= 60) return "Moderate candidate for review";
  if (score >= 30) return "Limited evidence candidate";
  if (score > 0) return "Weakly supported candidate";
  return "No local evidence found";
}

export function calculateGeneScore(input: {
  matches: MatchedPhenotype[];
  inputTermAssociationCounts: Map<string, number>;
  rankingMode: RankingMode;
  isCandidateGene: boolean;
  isValidatedGene: boolean;
  obsoleteInputHpoIds: Set<string>;
  hasNoCandidateAssociation: boolean;
}): { score: number; scoreBreakdown: ScoreBreakdown } {
  const exactMatches = input.matches.filter((match) => match.matchType === "EXACT");
  const ancestorMatches = input.matches.filter((match) => match.matchType === "ANCESTOR");

  const exactHpoMatch = Math.min(65, exactMatches.length * 32);
  const ancestorHpoMatch = Math.min(
    25,
    ancestorMatches.reduce((total, match) => total + Math.max(4, 14 - match.matchDepth * 3), 0),
  );
  const specificityWeight = Math.min(
    15,
    input.matches.reduce(
      (total, match) =>
        total +
        calculateTermSpecificity(input.inputTermAssociationCounts.get(match.inputHpoId) ?? 0),
      0,
    ),
  );
  const evidenceWeight = Math.min(
    8,
    input.matches.reduce((total, match) => {
      const evidence = match.associationEvidence;
      return (
        total +
        (evidence.diseaseId || evidence.diseaseName ? 2 : 0) +
        (evidence.evidenceSource ? 1 : 0)
      );
    }, 0),
  );
  const candidateBoost = input.rankingMode === "CANDIDATE_BOOSTED" && input.isCandidateGene ? 5 : 0;
  const literatureBoost = 0;

  let penalties = 0;
  if (!input.isValidatedGene) penalties -= 5;
  if (input.hasNoCandidateAssociation) penalties -= 10;
  if (input.matches.some((match) => input.obsoleteInputHpoIds.has(match.inputHpoId))) {
    penalties -= 5;
  }

  const rawScore =
    exactHpoMatch +
    ancestorHpoMatch +
    specificityWeight +
    evidenceWeight +
    candidateBoost +
    literatureBoost +
    penalties;
  const score = Math.min(100, Math.max(0, Number(rawScore.toFixed(1))));

  return {
    score,
    scoreBreakdown: {
      exactHpoMatch,
      ancestorHpoMatch,
      specificityWeight: Number(specificityWeight.toFixed(1)),
      evidenceWeight,
      candidateBoost,
      literatureBoost,
      penalties,
    },
  };
}
