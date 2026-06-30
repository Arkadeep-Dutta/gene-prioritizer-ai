import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { extractPhenotypes } from "@/lib/phenotype/extract";

describe("phenotype family-history detection", () => {
  it("classifies family history of seizures separately", async () => {
    const result = await extractPhenotypes(prisma, {
      text: "Family history of seizures.",
      useLLM: false,
    });

    expect(result.familyHistoryTerms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ hpoId: "HP:0001250", status: "FAMILY_HISTORY" }),
      ]),
    );
    expect(result.confirmedHpoTermsForRanking).toEqual([]);
  });

  it("separates patient phenotype from father phenotype", async () => {
    const result = await extractPhenotypes(prisma, {
      text: "Patient with seizures; father with cardiomyopathy.",
      useLLM: false,
    });

    expect(result.terms).toEqual(
      expect.arrayContaining([expect.objectContaining({ hpoId: "HP:0001250" })]),
    );
    expect(result.familyHistoryTerms).toEqual(
      expect.arrayContaining([expect.objectContaining({ hpoId: "HP:0001638" })]),
    );
    expect(result.confirmedHpoTermsForRanking).toEqual(["HP:0001250"]);
  });
});
