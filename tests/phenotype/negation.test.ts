import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { extractPhenotypes } from "@/lib/phenotype/extract";

describe("phenotype negation detection", () => {
  it("classifies no seizures as negated", async () => {
    const result = await extractPhenotypes(prisma, { text: "No seizures.", useLLM: false });

    expect(result.terms).toEqual([]);
    expect(result.negatedTerms).toEqual(
      expect.arrayContaining([expect.objectContaining({ hpoId: "HP:0001250", status: "NEGATED" })]),
    );
    expect(result.confirmedHpoTermsForRanking).not.toContain("HP:0001250");
  });

  it("separates present and negated phenotypes", async () => {
    const result = await extractPhenotypes(prisma, {
      text: "Patient has seizures and no hypotonia.",
      useLLM: false,
    });

    expect(result.terms).toEqual(
      expect.arrayContaining([expect.objectContaining({ hpoId: "HP:0001250", status: "PRESENT" })]),
    );
    expect(result.negatedTerms).toEqual(
      expect.arrayContaining([expect.objectContaining({ hpoId: "HP:0001252", status: "NEGATED" })]),
    );
    expect(result.confirmedHpoTermsForRanking).toEqual(["HP:0001250"]);
  });

  it("handles negated family history safely", async () => {
    const result = await extractPhenotypes(prisma, {
      text: "No family history of seizures.",
      useLLM: false,
    });

    expect(result.confirmedHpoTermsForRanking).toEqual([]);
    expect(result.terms).toEqual([]);
  });
});
