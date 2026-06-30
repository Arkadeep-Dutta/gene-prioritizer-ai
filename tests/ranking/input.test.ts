import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { normalizeRankingInput } from "@/lib/ranking/input";

const smallConfig = {
  algorithmVersion: "deterministic-hpo-v1",
  defaultLimit: 25,
  maxLimit: 100,
  candidateGeneLimit: 2,
  hpoTermLimit: 3,
  storeResultsDefault: true,
  privacyModeDefault: true,
  ancestorMaxDepth: 3,
};

describe("ranking input validation", () => {
  it("accepts valid HPO terms and normalizes/deduplicates terms and genes", async () => {
    const input = await normalizeRankingInput(
      prisma,
      {
        hpoTerms: ["HP:0001250", "HP:0001250", "HP:0001263"],
        candidateGenes: ["scn2a", "SCN2A"],
        rankingMode: "ALL_GENES",
      },
      smallConfig,
    );

    expect(input.hpoTerms.map((term) => term.hpoId)).toEqual(["HP:0001250", "HP:0001263"]);
    expect(input.candidateGenes).toHaveLength(1);
    expect(input.candidateGenes[0]).toMatchObject({ symbol: "SCN2A", isValidated: true });
  });

  it("rejects missing HPO terms, invalid HPO format, and unknown ranking mode", async () => {
    await expect(
      normalizeRankingInput(prisma, { hpoTerms: [] }, smallConfig),
    ).rejects.toMatchObject({
      code: "HPO_TERMS_REQUIRED",
    });
    await expect(
      normalizeRankingInput(prisma, { hpoTerms: ["HP:1250"] }, smallConfig),
    ).rejects.toMatchObject({ code: "HPO_ID_INVALID" });
    await expect(
      normalizeRankingInput(
        prisma,
        { hpoTerms: ["HP:0001250"], rankingMode: "LLM_MAGIC" },
        smallConfig,
      ),
    ).rejects.toThrow("Invalid enum value");
  });

  it("rejects too many HPO terms, too many candidate genes, unknown HPO terms, and raw text", async () => {
    await expect(
      normalizeRankingInput(
        prisma,
        { hpoTerms: ["HP:0001250", "HP:0001263", "HP:0001252", "HP:0001627"] },
        smallConfig,
      ),
    ).rejects.toMatchObject({ code: "HPO_TERM_LIMIT_EXCEEDED" });

    await expect(
      normalizeRankingInput(
        prisma,
        { hpoTerms: ["HP:0001250"], candidateGenes: ["SCN2A", "KCNQ2", "CACNA1A"] },
        smallConfig,
      ),
    ).rejects.toMatchObject({ code: "CANDIDATE_GENE_LIMIT_EXCEEDED" });

    await expect(
      normalizeRankingInput(prisma, { hpoTerms: ["HP:9999999"] }, smallConfig),
    ).rejects.toMatchObject({ code: "HPO_TERM_NOT_FOUND" });

    await expect(
      normalizeRankingInput(
        prisma,
        { hpoTerms: ["HP:0001250"], freeText: "patient has seizures" },
        smallConfig,
      ),
    ).rejects.toThrow("Unrecognized key");
  });
});
