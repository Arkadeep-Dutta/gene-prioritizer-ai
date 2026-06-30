export function normalizeGeneSymbol(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizeSearchText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function compactNullable(value: string | undefined | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function normalizeHeader(value: string): string {
  return value
    .trim()
    .replace(/^#/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
