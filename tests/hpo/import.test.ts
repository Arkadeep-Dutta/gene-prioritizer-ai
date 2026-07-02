import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { HPO_SOURCE_NAMES } from "@/lib/hpo/constants";
import { importHpoData } from "@/lib/hpo/import";

const execFileAsync = promisify(execFile);

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

  it("respects the HPO association import limit", async () => {
    const limited = await importHpoData(prisma, { ...fixturePaths, associationLimit: 2 });

    expect(limited.associations).toBeLessThanOrEqual(2);
    expect(limited.genes).toBeLessThanOrEqual(2);
  });

  it("build script exits successfully with bundled fixtures when raw files are absent", async () => {
    const hpoDataDir = await mkdtemp(resolve(process.cwd(), "hpo-build-"));

    try {
      const { stderr, stdout } = await execFileAsync("npm", ["run", "data:build-hpo"], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          HPO_ASSOCIATION_IMPORT_LIMIT: "2",
          HPO_DATA_DIR: hpoDataDir,
        },
        timeout: 60_000,
      });
      const output = `${stdout}\n${stderr}`;

      expect(output).toContain("Starting HPO build...");
      expect(output).toContain("Raw HPO files not found; using bundled synthetic fixtures.");
      expect(output).toContain("Imported phenotype terms:");
      expect(output).toContain("Imported genes:");
      expect(output).toContain("Imported associations:");
      expect(output).toContain("HPO build completed successfully.");
    } finally {
      await rm(hpoDataDir, { recursive: true, force: true });
    }
  }, 70_000);
});
