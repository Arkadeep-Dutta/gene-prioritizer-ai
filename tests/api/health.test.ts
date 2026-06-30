import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("reports reachable and seeded database status without leaking configuration", async () => {
    const response = await GET();
    const body: unknown = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      data: {
        status: "ok",
        build: {
          appVersion: expect.any(String),
        },
        deployment: {
          warningsCount: expect.any(Number),
          errorCount: expect.any(Number),
        },
        database: { configured: true, reachable: true },
        data: {
          seeded: true,
          hpoDataImported: true,
          counts: {
            hpoTerms: expect.any(Number),
            genes: expect.any(Number),
            genePhenotypeAssociations: expect.any(Number),
          },
        },
        llm: { configured: false, disabled: true },
      },
    });
    expect(
      (body as { data: { data: { counts: { hpoTerms: number } } } }).data.data.counts.hpoTerms,
    ).toBeGreaterThan(0);
    expect(serialized).not.toContain("DATABASE_URL");
    expect(serialized).not.toContain(process.env.DATABASE_URL);
    expect(serialized).not.toContain("change-me-in-production");
  });
});
