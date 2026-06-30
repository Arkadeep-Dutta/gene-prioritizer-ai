import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { normalizeRankingInput } from "@/lib/ranking/input";
import { rankGenes } from "@/lib/ranking/rank-genes";

async function run(body: Record<string, unknown>) {
  const input = await normalizeRankingInput(prisma, { storeResults: false, ...body });
  return rankGenes(prisma, input);
}

describe("deterministic gene ranking", () => {
  it("returns ranked genes for HPO terms only", async () => {
    const response = await run({ hpoTerms: ["HP:0001250", "HP:0001263"] });

    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results[0].gene.symbol).toBe("SCN2A");
    expect(response.results[0].scoreBreakdown.exactHpoMatch).toBeGreaterThan(0);
    expect(response.results[0]).not.toHaveProperty("geneId");
  });

  it("candidate-only mode returns only candidate genes and warns on no association", async () => {
    const response = await run({
      hpoTerms: ["HP:0001627"],
      candidateGenes: ["SCN2A", "PHASE5NONE"],
      rankingMode: "CANDIDATE_ONLY",
    });

    expect(response.results.map((result) => result.gene.symbol).sort()).toEqual([
      "PHASE5NONE",
      "SCN2A",
    ]);
    expect(response.results.every((result) => result.isCandidateGene)).toBe(true);
    expect(JSON.stringify(response.results)).toContain("No local HPO association matched");
  });

  it("candidate-boosted mode includes and boosts candidate genes", async () => {
    const response = await run({
      hpoTerms: ["HP:0001250"],
      candidateGenes: ["SCN2A"],
      rankingMode: "CANDIDATE_BOOSTED",
    });
    const scn2a = response.results.find((result) => result.gene.symbol === "SCN2A");

    expect(scn2a?.scoreBreakdown.candidateBoost).toBe(5);
  });

  it("discovery mode returns associated genes outside the candidate list", async () => {
    const response = await run({
      hpoTerms: ["HP:0001250"],
      candidateGenes: ["MYH7"],
      rankingMode: "DISCOVERY",
    });

    expect(response.results.map((result) => result.gene.symbol)).toEqual(
      expect.arrayContaining(["SCN2A", "CACNA1A", "KCNQ2"]),
    );
  });

  it("invalid candidate gene produces a warning, not a crash", async () => {
    const response = await run({
      hpoTerms: ["HP:0001250"],
      candidateGenes: ["BAD<script>"],
      rankingMode: "CANDIDATE_BOOSTED",
    });

    expect(response.warnings.join(" ")).toContain("Invalid candidate gene symbol");
  });

  it("returns an empty result set safely when no genes match", async () => {
    const response = await run({ hpoTerms: ["HP:0000001"] });
    expect(response.results).toEqual([]);
    expect(response.warnings.join(" ")).toContain("No local gene-phenotype associations matched");
  });
});
