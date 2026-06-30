import type { PhenotypeSpan } from "./types";

const UNCERTAINTY_PATTERNS = [
  /\bpossible\b/i,
  /\bsuspected\b/i,
  /\bconcern for\b/i,
  /\brule out\b/i,
  /\bquestionable\b/i,
  /\bmay have\b/i,
  /\bmight have\b/i,
  /\bhistory concerning for\b/i,
];

export function hasUncertaintyCue(sentence: string, span?: PhenotypeSpan): boolean {
  const scope = span ? sentence.slice(Math.max(0, span.start - 55), span.start) : sentence;
  return UNCERTAINTY_PATTERNS.some((pattern) => pattern.test(scope));
}
