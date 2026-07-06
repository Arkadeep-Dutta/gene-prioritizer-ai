import { afterEach, describe, expect, it } from "vitest";

import { GET } from "@/app/api/hpo/search/route";
import { resetRateLimitForTests } from "@/lib/security/rate-limit";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  resetRateLimitForTests();
});

describe("GET /api/hpo/search", () => {
  it("returns local search results", async () => {
    const response = await GET(new Request("http://localhost/api/hpo/search?q=seizure&limit=20"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.query).toBe("seizure");
    expect(body.data.results).toEqual(
      expect.arrayContaining([expect.objectContaining({ hpoId: "HP:0001250", label: "Seizure" })]),
    );
  });

  it("rejects missing query and caps limit without echoing raw input", async () => {
    const rawQuery = "infant seizures with family history and private note";
    const missing = await GET(
      new Request("http://localhost/api/hpo/search?q=" + encodeURIComponent(rawQuery.repeat(20))),
    );
    const missingBody = await missing.json();
    expect(missing.status).toBe(400);
    expect(JSON.stringify(missingBody)).not.toContain(rawQuery);

    const capped = await GET(new Request("http://localhost/api/hpo/search?q=seizure&limit=10000"));
    const body = await capped.json();
    expect(body.data.limit).toBe(50);
    expect(body.data.results.length).toBeLessThanOrEqual(50);
  });

  it("applies a rate limit to HPO search", async () => {
    process.env.RATE_LIMIT_ENABLED = "true";
    process.env.RATE_LIMIT_DEFAULT_MAX_REQUESTS = "1";
    process.env.RATE_LIMIT_WINDOW_SECONDS = "60";

    const first = await GET(
      new Request("http://localhost/api/hpo/search?q=seizure", {
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
    );
    const second = await GET(
      new Request("http://localhost/api/hpo/search?q=seizure", {
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.headers.get("Retry-After")).toBeTruthy();
  });
});
