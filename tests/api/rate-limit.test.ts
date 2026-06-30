import { afterEach, describe, expect, it } from "vitest";

import { POST as literatureSearch } from "@/app/api/literature/search/route";
import { resetRateLimitForTests } from "@/lib/security/rate-limit";

const originalEnv = { ...process.env };

function literatureRequest(ip = "203.0.113.10", body: unknown = {}) {
  return new Request("http://localhost/api/literature/search", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
  });
}

afterEach(() => {
  process.env = { ...originalEnv };
  resetRateLimitForTests();
});

describe("API rate limiting and request hardening", () => {
  it("returns 429 with Retry-After when endpoint limit is exceeded", async () => {
    process.env.RATE_LIMIT_ENABLED = "true";
    process.env.RATE_LIMIT_LITERATURE_MAX_REQUESTS = "1";
    process.env.RATE_LIMIT_WINDOW_SECONDS = "60";

    await literatureSearch(literatureRequest());
    const limited = await literatureSearch(literatureRequest());
    const body = await limited.json();

    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("returns a safe invalid JSON error", async () => {
    process.env.RATE_LIMIT_ENABLED = "false";

    const response = await literatureSearch(literatureRequest("203.0.113.11", "{not-json"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_JSON");
    expect(JSON.stringify(body)).not.toContain("SyntaxError");
  });
});
