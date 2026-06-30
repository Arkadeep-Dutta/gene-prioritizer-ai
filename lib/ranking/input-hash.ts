import { createHash } from "node:crypto";

import type { NormalizedRankingInput, SafeRankingMetadata } from "./types";

function sortObject(value: SafeRankingMetadata): SafeRankingMetadata {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function createRankingInputHash(input: NormalizedRankingInput): string {
  const payload = {
    algorithmVersion: input.algorithmVersion,
    hpoTerms: input.hpoTerms.map((term) => term.hpoId).sort(),
    candidateGenes: input.candidateGenes
      .map((gene) => gene.symbol ?? gene.normalizedInput)
      .filter(Boolean)
      .sort(),
    rankingMode: input.rankingMode,
    metadata: sortObject(input.metadata),
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
