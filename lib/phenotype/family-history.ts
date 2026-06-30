import type { PhenotypeSpan } from "./types";

const FAMILY_HISTORY_PATTERNS = [
  /\bfamily history\b/i,
  /\bpaternal history\b/i,
  /\bmaternal history\b/i,
  /\bfather (with|has|affected by)\b/i,
  /\bmother (with|has|affected by)\b/i,
  /\bsibling (with|has|affected by)\b/i,
  /\bbrother (with|has|affected by)\b/i,
  /\bsister (with|has|affected by)\b/i,
];

export function hasFamilyHistoryCue(sentence: string, span?: PhenotypeSpan): boolean {
  const scope = span ? sentence.slice(Math.max(0, span.start - 80), span.end + 20) : sentence;
  return FAMILY_HISTORY_PATTERNS.some((pattern) => pattern.test(scope));
}
