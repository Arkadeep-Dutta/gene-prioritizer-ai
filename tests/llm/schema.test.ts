import { describe, expect, it } from "vitest";

import { validateLlmPhenotypeMentions } from "@/lib/llm/schema";

describe("LLM phenotype schema", () => {
  it("validates structured LLM mentions", () => {
    const mentions = validateLlmPhenotypeMentions({
      mentions: [
        {
          phrase: "seizures",
          status: "PRESENT",
          confidence: 0.8,
          sourceText: "seizures",
          proposedHpoId: "HP:0001250",
        },
      ],
    });

    expect(mentions[0]).toMatchObject({ source: "llm", phrase: "seizures" });
  });

  it("rejects invalid status and invalid HPO format", () => {
    expect(() =>
      validateLlmPhenotypeMentions({
        mentions: [{ phrase: "x", status: "DIAGNOSIS", sourceText: "x" }],
      }),
    ).toThrow();
    expect(() =>
      validateLlmPhenotypeMentions({
        mentions: [{ phrase: "x", status: "PRESENT", sourceText: "x", proposedHpoId: "BAD" }],
      }),
    ).toThrow();
  });
});
