import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { extractPhenotypes } from "@/lib/phenotype/extract";

describe("phenotype uncertainty detection", () => {
  it.each([
    ["possible seizures", "HP:0001250"],
    ["suspected hypotonia", "HP:0001252"],
    ["concern for global developmental delay", "HP:0001263"],
  ])("classifies %s as uncertain", async (text, hpoId) => {
    const result = await extractPhenotypes(prisma, { text, useLLM: false });

    expect(result.uncertainTerms).toEqual(
      expect.arrayContaining([expect.objectContaining({ hpoId, status: "UNCERTAIN" })]),
    );
    expect(result.confirmedHpoTermsForRanking).not.toContain(hpoId);
  });
});
