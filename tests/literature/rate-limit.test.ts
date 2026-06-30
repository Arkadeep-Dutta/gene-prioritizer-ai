import { describe, expect, it } from "vitest";

import { resetRateLimitState, waitForRateLimit } from "@/lib/literature/rate-limit";

describe("NCBI rate limiter", () => {
  it("waits between requests for the same key", async () => {
    resetRateLimitState();
    await waitForRateLimit("ncbi", 1000);
    const startedAt = Date.now();
    await waitForRateLimit("ncbi", 20);

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(35);
  });
});
