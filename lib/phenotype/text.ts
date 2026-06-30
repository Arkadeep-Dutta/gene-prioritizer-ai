export type SentenceSpan = {
  text: string;
  start: number;
  end: number;
};

export function normalizeForMatching(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitIntoSentenceSpans(text: string): SentenceSpan[] {
  const spans: SentenceSpan[] = [];
  const pattern = /[^.!?;\n]+[.!?;\n]?/g;
  for (const match of text.matchAll(pattern)) {
    const raw = match[0];
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const leadingWhitespace = raw.search(/\S/);
    const start = (match.index ?? 0) + Math.max(leadingWhitespace, 0);
    spans.push({ text: trimmed, start, end: start + trimmed.length });
  }
  return spans.length ? spans : [{ text, start: 0, end: text.length }];
}

export function findNormalizedPhraseSpans(
  text: string,
  phrase: string,
): Array<{ start: number; end: number }> {
  const escapedWords = normalizeForMatching(phrase)
    .split(" ")
    .filter(Boolean)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!escapedWords.length) return [];
  const pattern = new RegExp(`\\b${escapedWords.join("[^a-zA-Z0-9]+")}\\b`, "gi");
  return Array.from(text.matchAll(pattern)).map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
}
