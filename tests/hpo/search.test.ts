import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { getGenesForHpoTerm, getPhenotypesForGene } from "@/lib/hpo/repository";
import { searchTerms } from "@/lib/hpo/search";

describe("local HPO repository/search", () => {
  it("supports exact HPO ID lookup", async () => {
    await expect(searchTerms(prisma, "HP:0001250")).resolves.toContainEqual(
      expect.objectContaining({ hpoId: "HP:0001250", score: 100 }),
    );
  });

  it("supports label, synonym, and obsolete term search", async () => {
    await expect(searchTerms(prisma, "Seizure")).resolves.toContainEqual(
      expect.objectContaining({ hpoId: "HP:0001250" }),
    );
    await expect(searchTerms(prisma, "Low muscle tone")).resolves.toContainEqual(
      expect.objectContaining({ hpoId: "HP:0001252" }),
    );
    await expect(searchTerms(prisma, "Old seizure label")).resolves.toContainEqual(
      expect.objectContaining({ hpoId: "HP:0009999", isObsolete: true }),
    );
  });

  it("queries genes for a term and phenotypes for a gene", async () => {
    const genes = await getGenesForHpoTerm(prisma, "HP:0001250");
    expect(genes.map((association) => association.gene.symbol)).toContain("SCN2A");

    const phenotypes = await getPhenotypesForGene(prisma, "scn2a");
    expect(phenotypes.map((association) => association.phenotypeTerm.hpoId)).toContain(
      "HP:0001250",
    );
  });
});
