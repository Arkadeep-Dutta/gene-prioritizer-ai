import { describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { extractPhenotypes } from "@/lib/phenotype/extract";

describe("phenotype extraction orchestration", () => {
  it("groups present, negated, uncertain, and family-history terms", async () => {
    const result = await extractPhenotypes(prisma, {
      text: "Infant with seizures and possible hypotonia. No microcephaly. Father with cardiomyopathy.",
      useLLM: false,
    });

    expect(result.method).toBe("deterministic");
    expect(result.terms).toEqual(
      expect.arrayContaining([expect.objectContaining({ hpoId: "HP:0001250" })]),
    );
    expect(result.uncertainTerms).toEqual(
      expect.arrayContaining([expect.objectContaining({ hpoId: "HP:0001252" })]),
    );
    expect(result.negatedTerms).toEqual(
      expect.arrayContaining([expect.objectContaining({ hpoId: "HP:0000252" })]),
    );
    expect(result.familyHistoryTerms).toEqual(
      expect.arrayContaining([expect.objectContaining({ hpoId: "HP:0001638" })]),
    );
    expect(result.confirmedHpoTermsForRanking).toEqual(["HP:0001250"]);
    expect(result.disclaimer).toContain("not a diagnosis");
  });

  it("falls back when LLM is requested but disabled and does not call provider", async () => {
    const provider = { extractPhenotypes: vi.fn() };
    const result = await extractPhenotypes(
      prisma,
      { text: "Seizures.", useLLM: true },
      {
        llmProvider: provider,
        llmConfig: {
          provider: "mock",
          model: "mock",
          disabled: true,
          timeoutMs: 1,
          retries: 0,
          maxInputChars: 100,
          apiKeyConfigured: true,
        },
      },
    );

    expect(provider.extractPhenotypes).not.toHaveBeenCalled();
    expect(result.method).toBe("deterministic");
    expect(result.warnings.join(" ")).toContain("DISABLE_LLM=true");
  });

  it("uses a mocked provider only when explicitly allowed and still maps locally", async () => {
    const provider = {
      extractPhenotypes: vi.fn().mockResolvedValue({
        mentions: [
          {
            phrase: "seizures",
            status: "PRESENT",
            confidence: 0.99,
            sourceText: "seizures",
            proposedHpoId: "HP:0001250",
          },
        ],
      }),
    };
    const result = await extractPhenotypes(
      prisma,
      { text: "seizures", useLLM: true },
      {
        config: {
          textMaxChars: 8000,
          maxExtractedTerms: 100,
          searchLimitPerPhrase: 10,
          requireConfirmation: true,
          allowExternalLlm: true,
        },
        llmConfig: {
          provider: "mock",
          model: "mock",
          disabled: false,
          timeoutMs: 1,
          retries: 0,
          maxInputChars: 100,
          apiKeyConfigured: true,
        },
        llmProvider: provider,
      },
    );

    expect(provider.extractPhenotypes).toHaveBeenCalledOnce();
    expect(result.method).toBe("llm");
    expect(result.terms[0]).toMatchObject({
      hpoId: "HP:0001250",
      mappingMethod: "llm_candidate_local_verified",
    });
  });
});
