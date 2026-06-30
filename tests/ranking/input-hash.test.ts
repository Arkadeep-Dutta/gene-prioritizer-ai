import { describe, expect, it } from "vitest";

import { createRankingInputHash } from "@/lib/ranking/input-hash";
import type { NormalizedRankingInput } from "@/lib/ranking/types";

function input(overrides: Partial<NormalizedRankingInput> = {}): NormalizedRankingInput {
  return {
    hpoTerms: [
      { hpoId: "HP:0001250", label: "Seizure", isObsolete: false },
      { hpoId: "HP:0001263", label: "Global developmental delay", isObsolete: false },
    ],
    candidateGenes: [
      {
        input: "SCN2A",
        normalizedInput: "SCN2A",
        symbol: "SCN2A",
        name: null,
        hgncId: null,
        entrezId: null,
        ncbiGeneId: null,
        ensemblId: null,
        validationStatus: "VALIDATED",
        isValidated: true,
        geneId: "internal-id",
        links: null,
        warnings: [],
      },
    ],
    rankingMode: "ALL_GENES",
    limit: 25,
    storeResults: false,
    privacyMode: true,
    includeLiterature: false,
    literatureRetmax: 10,
    literatureSummaries: false,
    metadata: {},
    warnings: [],
    algorithmVersion: "deterministic-hpo-v1",
    ...overrides,
  };
}

describe("ranking input hash", () => {
  it("is stable for normalized input and ignores candidate order", () => {
    const first = input({
      candidateGenes: [
        { ...input().candidateGenes[0], symbol: "SCN2A" },
        { ...input().candidateGenes[0], symbol: "KCNQ2", normalizedInput: "KCNQ2" },
      ],
    });
    const second = input({
      candidateGenes: [
        { ...input().candidateGenes[0], symbol: "KCNQ2", normalizedInput: "KCNQ2" },
        { ...input().candidateGenes[0], symbol: "SCN2A" },
      ],
    });

    expect(createRankingInputHash(first)).toBe(createRankingInputHash(second));
  });

  it("changes when HPO terms or ranking mode changes", () => {
    expect(createRankingInputHash(input())).not.toBe(
      createRankingInputHash(
        input({ hpoTerms: [{ hpoId: "HP:0001250", label: "Seizure", isObsolete: false }] }),
      ),
    );
    expect(createRankingInputHash(input())).not.toBe(
      createRankingInputHash(input({ rankingMode: "CANDIDATE_ONLY" })),
    );
  });

  it("does not include raw clinical text because the normalized model has no raw-text field", () => {
    const hash = createRankingInputHash(input({ metadata: { ageOfOnset: "infantile" } }));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(input())).not.toContain("patient has");
  });
});
