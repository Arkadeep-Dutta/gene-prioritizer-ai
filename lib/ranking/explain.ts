import type { RankedGene } from "./types";

export function explainRankedGene(result: Omit<RankedGene, "explanation">): string {
  const matchedLabels = result.matchedPhenotypes.map((match) => match.inputLabel);
  if (matchedLabels.length === 0) {
    return `${result.gene.symbol} has no local HPO association matching the submitted terms.`;
  }

  const termText =
    matchedLabels.length === 1
      ? matchedLabels[0]
      : `${matchedLabels.slice(0, -1).join(", ")} and ${matchedLabels.at(-1)}`;
  const candidateText = result.isCandidateGene ? " It was also supplied as a candidate gene." : "";

  return `${result.gene.symbol} is prioritized because local gene-phenotype associations match ${termText}.${candidateText}`;
}
