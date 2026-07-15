const identifierPatterns = [
  /\b\d{3}-\d{2}-\d{4}\b/,
  /medical record/i,
  /date of birth/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
];
export function containsLikelyIdentifier(value: string): boolean {
  return identifierPatterns.some((pattern) => pattern.test(value));
}
export function redactForLog(value: string): string {
  return containsLikelyIdentifier(value)
    ? "[REDACTED_IDENTIFIER_WARNING]"
    : value.replace(/HP:\d{7}/g, "[HPO_TERM]");
}
export function assertNoRawPhenotypePersisted(record: { rawPhenotypeText?: string | null }): void {
  if (record.rawPhenotypeText)
    throw new Error("Raw phenotype text must not be persisted by default.");
}
