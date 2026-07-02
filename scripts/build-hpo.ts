import "dotenv/config";

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { prisma } from "../lib/db/prisma";
import { HPO_SOURCE_FILES, DEFAULT_HPO_IMPORT_BATCH_SIZE } from "../lib/hpo/constants";
import { resolveHpoDataDir } from "../lib/hpo/download";
import { importHpoData } from "../lib/hpo/import";

export async function buildHpoData() {
  const dataDir = resolveHpoDataDir();
  const rawDir = resolve(dataDir, "raw");
  const batchSize = Number.parseInt(
    process.env.HPO_IMPORT_BATCH_SIZE ?? `${DEFAULT_HPO_IMPORT_BATCH_SIZE}`,
    10,
  );
  const associationLimit = process.env.HPO_ASSOCIATION_IMPORT_LIMIT
    ? Number.parseInt(process.env.HPO_ASSOCIATION_IMPORT_LIMIT, 10)
    : undefined;

  if (associationLimit !== undefined && Number.isFinite(associationLimit)) {
    console.log(`HPO association import limit enabled: ${associationLimit}`);
  }

  const rawSources = {
    ontologyPath: resolve(rawDir, HPO_SOURCE_FILES.ontology.fileName),
    phenotypeToGenesPath: resolve(rawDir, HPO_SOURCE_FILES.phenotypeToGenes.fileName),
    genesToPhenotypePath: resolve(rawDir, HPO_SOURCE_FILES.genesToPhenotype.fileName),
  };
  const missingRawSources = Object.values(rawSources).filter((path) => !existsSync(path));
  const sourcePaths =
    missingRawSources.length === 0
      ? rawSources
      : {
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

  if (missingRawSources.length > 0) {
    console.warn(
      "HPO raw source files are missing; importing bundled synthetic fixtures for offline local/CI verification.",
    );
  }

  const counts = await importHpoData(prisma, {
    ...sourcePaths,
    batchSize,
    associationLimit:
      associationLimit !== undefined && Number.isFinite(associationLimit)
        ? associationLimit
        : undefined,
  });

  console.log(`Imported HPO data: ${JSON.stringify(counts)}`);
  return counts;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  buildHpoData()
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
