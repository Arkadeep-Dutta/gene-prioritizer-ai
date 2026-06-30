export function parseDelimitedTokens(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => {
      const key = token.toUpperCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function normalizeHpoCode(token: string): string {
  const digitsOnly = token.replace(/^HP:?/i, "");
  return `HP:${digitsOnly.padStart(7, "0")}`;
}

export function parseHpoCodes(text: string): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const token of parseDelimitedTokens(text)) {
    const normalized = normalizeHpoCode(token);
    if (!/^HP:\d{7}$/.test(normalized)) {
      invalid.push(token);
      continue;
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
      valid.push(normalized);
    }
  }

  return { valid, invalid };
}

export function parseGeneSymbols(text: string): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const token of parseDelimitedTokens(text)) {
    const symbol = token.toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(symbol)) {
      invalid.push(token);
      continue;
    }
    if (!seen.has(symbol)) {
      seen.add(symbol);
      valid.push(symbol);
    }
  }

  return { valid, invalid };
}
