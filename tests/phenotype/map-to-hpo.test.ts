import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { mapMentionsToHpo } from "@/lib/phenotype/map-to-hpo";
import type { RawPhenotypeMention } from "@/lib/phenotype/types";

function mention(overrides: Partial<RawPhenotypeMention> = {}): RawPhenotypeMention {
  return {
    phrase: "seizures",
    status: "PRESENT",
    confidence: 0.9,
    sourceText: "seizures",
    source: "deterministic",
    warnings: [],
    ...overrides,
  };
}

describe("HPO phrase mapping", () => {
  it("maps phrases to local HPO labels or synonyms", async () => {
    const mapped = await mapMentionsToHpo(prisma, [mention()]);

    expect(mapped[0]).toMatchObject({
      hpoId: "HP:0001250",
      label: "Seizure",
      mappingMethod: "local_synonym",
    });
  });

  it("rejects unverified LLM HPO IDs by returning unmapped", async () => {
    const mapped = await mapMentionsToHpo(prisma, [
      mention({ phrase: "made up phenotype", proposedHpoId: "HP:9999999", source: "llm" }),
    ]);

    expect(mapped[0]).toMatchObject({ hpoId: null, status: "UNMAPPED" });
  });

  it("handles unavailable phrases safely", async () => {
    const mapped = await mapMentionsToHpo(prisma, [
      mention({ phrase: "moon face", sourceText: "moon face" }),
    ]);

    expect(mapped[0].status).toBe("UNMAPPED");
    expect(mapped[0].warnings.join(" ")).toContain("No local HPO term");
  });
});
