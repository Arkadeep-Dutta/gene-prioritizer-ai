const lastRequestAtByKey = new Map<string, number>();

export async function waitForRateLimit(key: string, requestsPerSecond: number): Promise<void> {
  const minIntervalMs = Math.ceil(1000 / Math.max(1, requestsPerSecond));
  const now = Date.now();
  const last = lastRequestAtByKey.get(key) ?? 0;
  const waitMs = Math.max(0, last + minIntervalMs - now);
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastRequestAtByKey.set(key, Date.now());
}

export function resetRateLimitState(): void {
  lastRequestAtByKey.clear();
}
