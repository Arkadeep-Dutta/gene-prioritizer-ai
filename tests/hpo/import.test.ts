import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { HPO_SOURCE_NAMES } from "@/lib/hpo/constants";
import { importHpoData } from "@/lib/hpo/import";
import { readHpoImportMode, resolveHpoImportPlan } from "../../scripts/build-hpo";

const execFileAsync = promisify(execFile);

const fixturePaths = {
  ontologyPath: resolve(process.cwd(), "tests/fixtures/hpo/hp.fixture.obo"),
  phenotypeToGenesPath: resolve(process.cwd(), "tests/fixtures/hpo/phenotype_to_genes.fixture.txt"),
  genesToPhenotypePath: resolve(process.cwd(), "tests/fixtures/hpo/genes_to_phenotype.fixture.txt"),
};

function env(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...process.env, ...overrides };
}

function lineCount(path: string): number {
  return readFileSync(path, "utf8").trim().split(/\r?\n/).length;
}
describe("importHpoData", () => {
  it("imports fixture data and is idempotent", async () => {
    const before = await prisma.genePhenotypeAssociation.count();
    const first = await importHpoData(prisma, fixturePaths);
    const afterFirst = await prisma.genePhenotypeAssociation.count();
    const second = await importHpoData(prisma, fixturePaths);
    const afterSecond = await prisma.genePhenotypeAssociation.count();

    expect(first.terms).toBeGreaterThanOrEqual(6);
    expect(first.terms).toBeLessThan(50);
    expect(first.synonyms).toBeGreaterThanOrEqual(4);
    expect(first.relationships).toBeGreaterThanOrEqual(4);
    expect(first.genes).toBeGreaterThanOrEqual(6);
    expect(first.genes).toBeLessThan(50);
    expect(first.associations).toBeLessThan(50);
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

  it("respects the HPO association import limit in fixture mode", async () => {
    const limited = await importHpoData(prisma, { ...fixturePaths, associationLimit: 2 });

    expect(limited.associations).toBeLessThanOrEqual(2);
    expect(limited.genes).toBeLessThanOrEqual(2);
  });
  it("emits parse and database progress when requested", async () => {
    const messages: string[] = [];

    await importHpoData(prisma, {
      ...fixturePaths,
      batchSize: 2,
      onProgress: (message) => messages.push(message),
    });

    expect(messages.some((message) => message.includes("Parsing hp.obo started"))).toBe(true);
    expect(messages.some((message) => message.includes("Parsing hp.obo finished"))).toBe(true);
    expect(messages.some((message) => message.includes("Parsing phenotype_to_genes started"))).toBe(
      true,
    );
    expect(
      messages.some((message) => message.includes("Parsing phenotype_to_genes finished")),
    ).toBe(true);
    expect(messages.some((message) => message.includes("Parsing genes_to_phenotype started"))).toBe(
      true,
    );
    expect(
      messages.some((message) => message.includes("Parsing genes_to_phenotype finished")),
    ).toBe(true);
    expect(
      messages.some((message) => message.includes("Parsed HPO totals before database import")),
    ).toBe(true);
    expect(
      messages.some((message) => message.includes("Database import: gene-phenotype associations")),
    ).toBe(true);
    expect(messages.at(-1)).toBe("Database import finished.");
  });

  it("defaults to bounded fixture mode even when raw HPO files are present", () => {
    const plan = resolveHpoImportPlan(
      env({
        HPO_IMPORT_MODE: undefined,
        HPO_ASSOCIATION_IMPORT_LIMIT: undefined,
        HPO_DATA_DIR: "./data/hpo",
      }),
    );

    expect(plan.mode).toBe("fixture");
    expect(plan.sourcePaths.ontologyPath).toBe(fixturePaths.ontologyPath);
    expect(plan.sourcePaths.phenotypeToGenesPath).toBe(fixturePaths.phenotypeToGenesPath);
    expect(plan.sourcePaths.genesToPhenotypePath).toBe(fixturePaths.genesToPhenotypePath);
  });

  it("uses full raw HPO files only when explicitly requested", () => {
    const plan = resolveHpoImportPlan(
      env({
        HPO_IMPORT_MODE: "full",
        HPO_ASSOCIATION_IMPORT_LIMIT: undefined,
        HPO_DATA_DIR: "./data/hpo",
      }),
    );

    expect(plan.mode).toBe("full");
    expect(plan.sourcePaths.ontologyPath).toContain("data/hpo/raw/hp.obo");
    expect(plan.sourcePaths.phenotypeToGenesPath).toContain("data/hpo/raw/phenotype_to_genes.txt");
    expect(plan.sourcePaths.genesToPhenotypePath).toContain("data/hpo/raw/genes_to_phenotype.txt");
    expect(lineCount(plan.sourcePaths.phenotypeToGenesPath)).toBeGreaterThan(1_000);
    expect(lineCount(plan.sourcePaths.genesToPhenotypePath)).toBeGreaterThan(1_000);
  });

  it("fails clearly for invalid HPO import mode", () => {
    expect(() => readHpoImportMode(env({ HPO_IMPORT_MODE: "everything" }))).toThrow(
      'Invalid HPO_IMPORT_MODE "everything". Allowed values: fixture, full.',
    );
  });

  it("fails clearly when full mode is requested without raw files", async () => {
    const hpoDataDir = await mkdtemp(resolve(process.cwd(), "hpo-full-missing-"));

    try {
      expect(() =>
        resolveHpoImportPlan(
          env({
            HPO_IMPORT_MODE: "full",
            HPO_ASSOCIATION_IMPORT_LIMIT: undefined,
            HPO_DATA_DIR: hpoDataDir,
          }),
        ),
      ).toThrow("HPO_IMPORT_MODE=full requires raw HPO source files");
    } finally {
      await rm(hpoDataDir, { recursive: true, force: true });
    }
  });

  it("rejects bounded association limits in full mode", () => {
    expect(() =>
      resolveHpoImportPlan(
        env({
          HPO_IMPORT_MODE: "full",
          HPO_ASSOCIATION_IMPORT_LIMIT: "2",
          HPO_DATA_DIR: "./data/hpo",
        }),
      ),
    ).toThrow("HPO_ASSOCIATION_IMPORT_LIMIT is not allowed with HPO_IMPORT_MODE=full");
  });

  it("build script exits successfully with bundled fixture mode", async () => {
    const hpoDataDir = await mkdtemp(resolve(process.cwd(), "hpo-build-"));

    try {
      const { stderr, stdout } = await execFileAsync("npm", ["run", "data:build-hpo"], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          HPO_IMPORT_MODE: "fixture",
          HPO_ASSOCIATION_IMPORT_LIMIT: "2",
          HPO_DATA_DIR: hpoDataDir,
        },
        timeout: 60_000,
      });
      const output = stdout + "\n" + stderr;

      expect(output).toContain("Starting HPO build...");
      expect(output).toContain("HPO import mode: fixture");
      expect(output).toContain("Using bounded bundled synthetic HPO fixtures");
      expect(output).toContain("Imported phenotype terms:");
      expect(output).toContain("Imported genes:");
      expect(output).toContain("Imported associations:");
      expect(output).toContain("HPO build completed successfully.");
    } finally {
      await rm(hpoDataDir, { recursive: true, force: true });
    }
  }, 70_000);

  it("does not introduce GeneCards scraping into HPO import code", () => {
    const hpoImportCode = ["scripts/build-hpo.ts", "lib/hpo/import.ts", "lib/hpo/download.ts"]
      .map((path) => readFileSync(resolve(process.cwd(), path), "utf8"))
      .join("\n");

    expect(existsSync(resolve(process.cwd(), "lib/genecards"))).toBe(true);
    expect(hpoImportCode).not.toMatch(/genecards/i);
    expect(hpoImportCode).not.toMatch(/scrap|crawl/i);
  });
});
