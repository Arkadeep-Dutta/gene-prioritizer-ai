import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { HPO_SOURCE_NAMES } from "@/lib/hpo/constants";
import { importHpoData } from "@/lib/hpo/import";

const fixturePaths = {
  ontologyPath: resolve(process.cwd(), "tests/fixtures/hpo/hp.fixture.obo"),
  phenotypeToGenesPath: resolve(process.cwd(), "tests/fixtures/hpo/phenotype_to_genes.fixture.txt"),
  genesToPhenotypePath: resolve(process.cwd(), "tests/fixtures/hpo/genes_to_phenotype.fixture.txt"),
};

describe("importHpoData", () => {
  it("imports fixture data and is idempotent", async () => {
    const before = await prisma.genePhenotypeAssociation.count();
    const first = await importHpoData(prisma, fixturePaths);
    const afterFirst = await prisma.genePhenotypeAssociation.count();
    const second = await importHpoData(prisma, fixturePaths);
    const afterSecond = await prisma.genePhenotypeAssociation.count();

    expect(first.terms).toBeGreaterThanOrEqual(6);
    expect(first.synonyms).toBeGreaterThanOrEqual(4);
    expect(first.relationships).toBeGreaterThanOrEqual(4);
    expect(first.genes).toBeGreaterThanOrEqual(6);
    expect(afterFirst).toBeGreaterThanOrEqual(before);
    expect(second.associations).toBe(first.associations);
    expect(afterSecond).toBe(afterFirst);

    await expect(
      prisma.phenotypeTerm.findUnique({ where: { hpoId: "HP:0001250" } }),
    ).resolves.not.toBeNull();
    await expect(prisma.phenotypeSynonym.count()).resolves.toBeGreaterThan(0);
    await expect(prisma.phenotypeRelationship.count()).resolves.toBeGreaterThan(0);
    await expect(
      prisma.gene.findUnique({ where: { symbol: "PHASE3GENE" } }),
    ).resolves.toMatchObject({
      validationStatus: "UNVALIDATED",
    });
    await expect(
      prisma.dataSourceVersion.findFirst({
        where: { sourceName: HPO_SOURCE_NAMES.ontology },
      }),
    ).resolves.not.toBeNull();
    await expect(prisma.licensedGeneCardsImport.count()).resolves.toBe(0);
  });
});
