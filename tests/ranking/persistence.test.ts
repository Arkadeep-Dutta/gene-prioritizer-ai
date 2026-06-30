import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { normalizeRankingInput } from "@/lib/ranking/input";
import { createRankingInputHash } from "@/lib/ranking/input-hash";
import { rankGenes } from "@/lib/ranking/rank-genes";

const body = {
  hpoTerms: ["HP:0001250", "HP:0001263"],
  candidateGenes: ["SCN2A", "KCNQ2"],
  rankingMode: "CANDIDATE_BOOSTED",
  metadata: { ageOfOnset: "unknown" },
};

afterEach(async () => {
  await prisma.userCase.deleteMany({ where: { inputType: "HPO_RANKING" } });
});

describe("ranking persistence", () => {
  it("storeResults=true creates privacy-safe UserCase and GeneRankingResult rows", async () => {
    const input = await normalizeRankingInput(prisma, { ...body, storeResults: true });
    const response = await rankGenes(prisma, input);
    const userCase = await prisma.userCase.findUnique({
      where: { inputHash: createRankingInputHash(input) },
      include: { rankingResults: true },
    });

    expect(response.caseId).toBeTruthy();
    expect(userCase).toMatchObject({
      inputType: "HPO_RANKING",
      rawTextStored: false,
      consentToStoreRawText: false,
      rawTextRedacted: null,
      privacyMode: true,
    });
    expect(userCase?.rankingResults.length).toBeGreaterThan(0);
    expect(userCase?.rankingResults[0].scoreBreakdown).toBeTruthy();
    expect(userCase?.rankingResults[0].matchedPhenotypes).toBeTruthy();
    expect(JSON.stringify(userCase)).not.toContain("patient has");
  });

  it("storeResults=false does not create ranking records", async () => {
    const input = await normalizeRankingInput(prisma, { ...body, storeResults: false });
    await rankGenes(prisma, input);

    await expect(
      prisma.userCase.findUnique({ where: { inputHash: createRankingInputHash(input) } }),
    ).resolves.toBeNull();
  });

  it("repeated identical requests replace rows deterministically", async () => {
    const input = await normalizeRankingInput(prisma, { ...body, storeResults: true });
    const first = await rankGenes(prisma, input);
    const second = await rankGenes(prisma, input);
    const count = await prisma.geneRankingResult.count({ where: { userCaseId: first.caseId } });

    expect(first.inputHash).toBe(second.inputHash);
    expect(first.caseId).toBe(second.caseId);
    expect(count).toBe(second.results.length);
  });
});
