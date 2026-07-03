import "dotenv/config";

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { prisma } from "../lib/db/prisma";
import {
  DEFAULT_HPO_IMPORT_BATCH_SIZE,
  DEFAULT_HPO_IMPORT_MODE,
  HPO_IMPORT_MODES,
  HPO_SOURCE_FILES,
  type HpoImportMode,
} from "../lib/hpo/constants";
import { resolveHpoDataDir } from "../lib/hpo/download";
import { importHpoData } from "../lib/hpo/import";

const FIXTURE_SOURCE_PATHS = {
  ontologyPath: resolve(process.cwd(), "tests/fixtures/hpo/hp.fixture.obo"),
  phenotypeToGenesPath: resolve(process.cwd(), "tests/fixtures/hpo/phenotype_to_genes.fixture.txt"),
  genesToPhenotypePath: resolve(process.cwd(), "tests/fixtures/hpo/genes_to_phenotype.fixture.txt"),
};

type HpoBuildEnv = NodeJS.ProcessEnv;

export type HpoImportPlan = {
  mode: HpoImportMode;
  rawDir: string;
  sourcePaths: typeof FIXTURE_SOURCE_PATHS;
  batchSize: number;
  associationLimit?: number;
  missingRawSources: string[];
};

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readAssociationLimit(env: HpoBuildEnv = process.env): number | undefined {
  if (!env.HPO_ASSOCIATION_IMPORT_LIMIT) return undefined;
  const parsed = Number.parseInt(env.HPO_ASSOCIATION_IMPORT_LIMIT, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : undefined;
}

export function readHpoImportMode(env: HpoBuildEnv = process.env): HpoImportMode {
  const configured = env.HPO_IMPORT_MODE?.trim();
  if (!configured) return DEFAULT_HPO_IMPORT_MODE;
  if ((HPO_IMPORT_MODES as readonly string[]).includes(configured))
    return configured as HpoImportMode;
  throw new Error(
    'Invalid HPO_IMPORT_MODE "' +
      env.HPO_IMPORT_MODE +
      '". Allowed values: ' +
      HPO_IMPORT_MODES.join(", ") +
      ".",
  );
}

function getRawSourcePaths(rawDir: string): typeof FIXTURE_SOURCE_PATHS {
  return {
    ontologyPath: resolve(rawDir, HPO_SOURCE_FILES.ontology.fileName),
    phenotypeToGenesPath: resolve(rawDir, HPO_SOURCE_FILES.phenotypeToGenes.fileName),
    genesToPhenotypePath: resolve(rawDir, HPO_SOURCE_FILES.genesToPhenotype.fileName),
  };
}

function getMissingRawSources(rawSources: typeof FIXTURE_SOURCE_PATHS): string[] {
  return Object.entries(rawSources)
    .filter(([, path]) => !existsSync(path))
    .map(([name, path]) => name + ": " + path);
}

function officialDownloadSummary(): string {
  return Object.values(HPO_SOURCE_FILES)
    .map((source) => source.fileName + " from " + source.url)
    .join("; ");
}

export function resolveHpoImportPlan(env: HpoBuildEnv = process.env): HpoImportPlan {
  const mode = readHpoImportMode(env);
  const dataDir = resolveHpoDataDir(env.HPO_DATA_DIR);
  const rawDir = resolve(dataDir, "raw");
  const rawSources = getRawSourcePaths(rawDir);
  const missingRawSources = getMissingRawSources(rawSources);
  const associationLimit = readAssociationLimit(env);
  const batchSize = readPositiveInteger(env.HPO_IMPORT_BATCH_SIZE, DEFAULT_HPO_IMPORT_BATCH_SIZE);

  if (mode === "full") {
    if (associationLimit !== undefined) {
      throw new Error(
        "HPO_ASSOCIATION_IMPORT_LIMIT is not allowed with HPO_IMPORT_MODE=full. Use HPO_IMPORT_MODE=fixture for bounded verification, or unset the limit for full import.",
      );
    }
    if (missingRawSources.length > 0) {
      throw new Error(
        "HPO_IMPORT_MODE=full requires raw HPO source files in " +
          rawDir +
          ". Missing: " +
          missingRawSources.join(", ") +
          ". Run npm run data:download-hpo or place official files manually: " +
          officialDownloadSummary() +
          ".",
      );
    }
    return { mode, rawDir, sourcePaths: rawSources, batchSize, missingRawSources };
  }

  return {
    mode,
    rawDir,
    sourcePaths: FIXTURE_SOURCE_PATHS,
    batchSize,
    associationLimit,
    missingRawSources,
  };
}

export async function buildHpoData() {
  console.log("Starting HPO build...");

  const plan = resolveHpoImportPlan();
  console.log("HPO import mode: " + plan.mode);

  if (plan.mode === "fixture") {
    console.log(
      "Using bounded bundled synthetic HPO fixtures for tests, CI, and local verification.",
    );
    if (plan.missingRawSources.length > 0) {
      console.log("Raw HPO files are not required for fixture mode.");
    } else {
      console.log(
        "Raw HPO files are present but ignored because HPO_IMPORT_MODE is fixture/default.",
      );
    }
  } else {
    if (process.env.CI) {
      console.log(
        "CI detected; full HPO import is running only because HPO_IMPORT_MODE=full was explicitly set.",
      );
    }
    console.log("Using raw HPO source files from " + plan.rawDir + ".");
  }

  if (plan.associationLimit !== undefined) {
    console.log("HPO association import limit enabled: " + plan.associationLimit);
  }

  const counts = await importHpoData(prisma, {
    ...plan.sourcePaths,
    batchSize: plan.batchSize,
    associationLimit: plan.associationLimit,
    onProgress: plan.mode === "full" ? (message) => console.log(message) : undefined,
  });

  console.log("Imported phenotype terms: " + counts.terms);
  console.log("Imported genes: " + counts.genes);
  console.log("Imported associations: " + counts.associations);
  console.log("Skipped associations: " + counts.associationsSkipped);
  console.log("Import warnings: " + counts.warnings);
  console.log("HPO build completed successfully.");
  return counts;
}

async function main() {
  await buildHpoData();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main()
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error("HPO build failed: " + message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
