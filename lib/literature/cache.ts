const queryCache = new Map<string, { pmids: string[]; expiresAt: number }>();

export function getCachedQueryPmids(query: string): string[] | null {
  const cached = queryCache.get(query);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    queryCache.delete(query);
    return null;
  }
  return cached.pmids;
}

export function setCachedQueryPmids(query: string, pmids: string[], ttlSeconds: number): void {
  queryCache.set(query, { pmids, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function clearLiteratureQueryCache(): void {
  queryCache.clear();
}
