import "dotenv/config";

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { prisma } from "../lib/db/prisma";
import { DEFAULT_HPO_IMPORT_BATCH_SIZE, HPO_SOURCE_FILES } from "../lib/hpo/constants";
import { resolveHpoDataDir } from "../lib/hpo/download";
import { importHpoData } from "../lib/hpo/import";

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readAssociationLimit(): number | undefined {
  if (!process.env.HPO_ASSOCIATION_IMPORT_LIMIT) return undefined;
  const parsed = Number.parseInt(process.env.HPO_ASSOCIATION_IMPORT_LIMIT, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : undefined;
}

export async function buildHpoData() {
  console.log("Starting HPO build...");

  const dataDir = resolveHpoDataDir();
  const rawDir = resolve(dataDir, "raw");
  const batchSize = readPositiveInteger(
    process.env.HPO_IMPORT_BATCH_SIZE,
    DEFAULT_HPO_IMPORT_BATCH_SIZE,
  );
  const associationLimit = readAssociationLimit();

  if (associationLimit !== undefined) {
    console.log(`HPO association import limit enabled: ${associationLimit}`);
  }

  const rawSources = {
    ontologyPath: resolve(rawDir, HPO_SOURCE_FILES.ontology.fileName),
    phenotypeToGenesPath: resolve(rawDir, HPO_SOURCE_FILES.phenotypeToGenes.fileName),
    genesToPhenotypePath: resolve(rawDir, HPO_SOURCE_FILES.genesToPhenotype.fileName),
  };
  const fixtureSources = {
    ontologyPath: resolve(process.cwd(), "tests/fixtures/hpo/hp.fixture.obo"),
    phenotypeToGenesPath: resolve(
      process.cwd(),
      "tests/fixtures/hpo/phenotype_to_genes.fixture.txt",
    ),
    genesToPhenotypePath: resolve(
      process.cwd(),
      "tests/fixtures/hpo/genes_to_phenotype.fixture.txt",
    ),
  };

  const missingRawSources = Object.values(rawSources).filter((path) => !existsSync(path));
  const shouldUseFixtures = missingRawSources.length > 0 || associationLimit !== undefined;
  const sourcePaths = shouldUseFixtures ? fixtureSources : rawSources;

  if (missingRawSources.length > 0) {
    console.log("Raw HPO files not found; using bundled synthetic fixtures.");
  } else if (shouldUseFixtures) {
    console.log("Raw HPO files found; using bundled synthetic fixtures for bounded verification.");
  } else {
    console.log("Raw HPO files found; importing local HPO data.");
  }

  const counts = await importHpoData(prisma, {
    ...sourcePaths,
    batchSize,
    associationLimit,
  });

  console.log(`Imported phenotype terms: ${counts.terms}`);
  console.log(`Imported genes: ${counts.genes}`);
  console.log(`Imported associations: ${counts.associations}`);
  console.log(`Skipped associations: ${counts.associationsSkipped}`);
  console.log(`Import warnings: ${counts.warnings}`);
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
      console.error(`HPO build failed: ${message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
