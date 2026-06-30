import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { GET as dataVersion } from "@/app/api/data/version/route";
import { GET as health } from "@/app/api/health/route";
import { prisma } from "@/lib/db/prisma";

describe("gene validation security and privacy", () => {
  it("does not include GeneCards scrape/fetch logic in linkout helpers", async () => {
    const linkouts = await readFile(resolve(process.cwd(), "lib/genes/linkouts.ts"), "utf8");

    expect(linkouts).toContain("genecards.org");
    expect(linkouts).not.toMatch(/fetch\s*\(/);
    expect(linkouts).not.toMatch(/scrap/i);
  });

  it("does not import GeneCards data in fixtures", async () => {
    await expect(prisma.licensedGeneCardsImport.count()).resolves.toBe(0);
    await expect(prisma.licensedGeneCardsGeneAnnotation.count()).resolves.toBe(0);
  });

  it("health and data routes do not leak secrets or database URLs", async () => {
    const responses = await Promise.all([health(), dataVersion()]);
    for (const response of responses) {
      const serialized = JSON.stringify(await response.json());
      expect(serialized).not.toContain("DATABASE_URL");
      expect(serialized).not.toContain(process.env.DATABASE_URL);
      expect(serialized).not.toContain("OPENAI_API_KEY");
      expect(serialized).not.toContain("change-me-in-production");
    }
  });
});
