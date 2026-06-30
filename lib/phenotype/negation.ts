import type { PhenotypeSpan } from "./types";

const NEGATION_PATTERNS = [
  /\bno\b/i,
  /\bdenies?\b/i,
  /\bwithout\b/i,
  /\bnegative for\b/i,
  /\bno evidence of\b/i,
  /\babsent\b/i,
  /\bruled out\b/i,
  /\bdoes not have\b/i,
  /\bnormal head size\b/i,
];

export function hasNegationCue(sentence: string, span?: PhenotypeSpan): boolean {
  const scope = span ? sentence.slice(Math.max(0, span.start - 45), span.start) : sentence;
  return NEGATION_PATTERNS.some((pattern) => pattern.test(scope));
}
