import { describe, expect, it } from "vitest";

import { runSmokeApi } from "@/scripts/deployment/smoke-api";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("deployment smoke API script", () => {
  it("passes against mocked safe endpoints", async () => {
    const fetchFn = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/")) return new Response("Research and educational use only");
      if (url.endsWith("/api/health")) return json({ ok: true, data: { status: "ok" } });
      if (url.endsWith("/api/data/version")) return json({ ok: true, data: {} });
      if (url.endsWith("/api/phenotype/extract")) return json({ ok: true, data: { terms: [] } });
      if (url.endsWith("/api/prioritize")) return json({ ok: true, data: { results: [] } });
      return json({ ok: false }, 404);
    };

    await expect(runSmokeApi({ baseUrl: "http://fixture.test", fetchFn })).resolves.toBeUndefined();
  });

  it("fails when an endpoint leaks secret-like text", async () => {
    const fetchFn = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/")) return new Response("Research and educational use only");
      if (url.endsWith("/api/health")) return json({ ok: true, data: { value: "DATABASE_URL" } });
      return json({ ok: true, data: {} });
    };

    await expect(runSmokeApi({ baseUrl: "http://fixture.test", fetchFn })).rejects.toThrow(
      "leaked secret-like text",
    );
  });
});
