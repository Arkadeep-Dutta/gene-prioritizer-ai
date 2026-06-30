import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/hpo/search/route";

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

  it("rejects missing query and caps limit", async () => {
    const missing = await GET(new Request("http://localhost/api/hpo/search"));
    expect(missing.status).toBe(400);

    const capped = await GET(new Request("http://localhost/api/hpo/search?q=seizure&limit=10000"));
    const body = await capped.json();
    expect(body.data.limit).toBe(50);
    expect(body.data.results.length).toBeLessThanOrEqual(50);
  });
});
