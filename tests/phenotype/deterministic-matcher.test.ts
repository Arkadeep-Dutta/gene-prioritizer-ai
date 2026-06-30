import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { deterministicPhenotypeMatch } from "@/lib/phenotype/deterministic-matcher";

describe("deterministic phenotype matcher", () => {
  it("maps fixture labels and synonyms without an LLM", async () => {
    const mentions = await deterministicPhenotypeMatch(
      prisma,
      "Infant with seizures, global developmental delay, and hypotonia.",
    );

    expect(mentions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ proposedHpoId: "HP:0001250", status: "PRESENT" }),
        expect.objectContaining({ proposedHpoId: "HP:0001263", status: "PRESENT" }),
        expect.objectContaining({ proposedHpoId: "HP:0001252", status: "PRESENT" }),
      ]),
    );
  });

  it("maps fixture synonyms without an LLM", async () => {
    const mentions = await deterministicPhenotypeMatch(prisma, "Low muscle tone is present.");

    expect(mentions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          proposedHpoId: "HP:0001252",
          status: "PRESENT",
        }),
      ]),
    );
    expect(mentions.map((mention) => mention.phrase.toLowerCase())).toContain("low muscle tone");
  });

  it("deduplicates repeated mentions and avoids generic false positives", async () => {
    const repeated = await deterministicPhenotypeMatch(prisma, "Seizures and seizures.");
    const generic = await deterministicPhenotypeMatch(
      prisma,
      "The patient has normal development.",
    );

    expect(repeated.filter((mention) => mention.proposedHpoId === "HP:0001250")).toHaveLength(1);
    expect(generic).toEqual([]);
  });

  it("returns no matches cleanly when no phenotype phrase is found", async () => {
    await expect(deterministicPhenotypeMatch(prisma, "Enjoys music and school.")).resolves.toEqual(
      [],
    );
  });
});
