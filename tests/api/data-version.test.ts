import { describe, expect, it } from "vitest";

import { GET as getDataVersion } from "@/app/api/data/version/route";
import { GET as getHealth } from "@/app/api/health/route";

describe("data version and health API safety", () => {
  it("returns HPO source versions without leaking secrets", async () => {
    const response = await getDataVersion();
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      data: {
        imported: {
          hpoOntology: true,
          hpoGeneAssociations: true,
          syntheticFixture: true,
        },
      },
    });
    expect(serialized).not.toContain("DATABASE_URL");
    expect(serialized).not.toContain(process.env.DATABASE_URL);
  });

  it("health includes HPO data status without secrets", async () => {
    const response = await getHealth();
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.data.data.hpoDataImported).toBe(true);
    expect(body.data.data.counts.hpoTerms).toBeGreaterThan(0);
    expect(serialized).not.toContain("DATABASE_URL");
    expect(serialized).not.toContain(process.env.DATABASE_URL);
  });
});
