import type { ParsedGeneInput } from "./types";

export const MAX_GENE_SYMBOL_LENGTH = 40;
export const MAX_GENE_TEXT_LENGTH = 10_000;
const GENE_SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9.-]*$/;

export function normalizeGeneSymbol(input: string): string | null {
  const normalized = input.trim().toUpperCase();
  if (!normalized) return null;
  if (!isPlausibleGeneSymbol(normalized)) return null;
  return normalized;
}

export function isPlausibleGeneSymbol(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (trimmed.length > MAX_GENE_SYMBOL_LENGTH) return false;
  return GENE_SYMBOL_PATTERN.test(trimmed.toUpperCase());
}

export function splitGeneText(input: string): string[] {
  if (input.length > MAX_GENE_TEXT_LENGTH) {
    return [input];
  }
  return input
    .split(/[\s,;]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function normalizeGeneSymbolList(input: string[] | string): string[] {
  const values = Array.isArray(input) ? input : splitGeneText(input);
  const normalized = new Set<string>();
  for (const value of values) {
    const symbol = normalizeGeneSymbol(value);
    if (symbol) normalized.add(symbol);
  }
  return Array.from(normalized);
}

export function parseGeneSymbolInput(input: string[] | string): ParsedGeneInput[] {
  const values = Array.isArray(input) ? input : splitGeneText(input);
  const seen = new Set<string>();
  const parsed: ParsedGeneInput[] = [];

  for (const rawValue of values) {
    const original = rawValue.trim();
    if (!original) continue;
    const normalized = normalizeGeneSymbol(original);
    const key = normalized ?? `invalid:${original}`;
    if (seen.has(key)) continue;
    seen.add(key);
    parsed.push({ original, normalized, validFormat: normalized !== null });
  }

  return parsed;
}
