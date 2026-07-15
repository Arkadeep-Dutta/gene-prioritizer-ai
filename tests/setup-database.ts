import { execFileSync } from "node:child_process";
import { closeSync, existsSync, openSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

async function removeIfExists(path: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      if (existsSync(path)) rmSync(path, { force: true });
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((resolveRetry) => setTimeout(resolveRetry, 100));
    }
  }
}

export default async function setupDatabase() {
  Object.assign(process.env, {
    NODE_ENV: "test",
    DATABASE_URL: "file:./test.db",
  });

  const databasePath = fileURLToPath(new URL("../prisma/test.db", import.meta.url));
  const prismaCli = fileURLToPath(
    new URL("../node_modules/prisma/build/index.js", import.meta.url),
  );

  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    const path = `${databasePath}${suffix}`;
    if (existsSync(path)) rmSync(path, { force: true });
  }
  closeSync(openSync(databasePath, "w"));

  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    env: process.env,
    stdio: "pipe",
  });

  const { seedDatabase } = await import("../prisma/seed");
  await seedDatabase();
  const { prisma } = await import("../lib/db/prisma");
  const { importHpoData } = await import("../lib/hpo/import");
  await importHpoData(prisma, {
    ontologyPath: resolve(process.cwd(), "tests/fixtures/hpo/hp.fixture.obo"),
    phenotypeToGenesPath: resolve(
      process.cwd(),
      "tests/fixtures/hpo/phenotype_to_genes.fixture.txt",
    ),
    genesToPhenotypePath: resolve(
      process.cwd(),
      "tests/fixtures/hpo/genes_to_phenotype.fixture.txt",
    ),
  });

  return async () => {
    const { disconnectSeedDatabase } = await import("../prisma/seed");
    await Promise.all([disconnectSeedDatabase(), prisma.$disconnect()]);

    for (const suffix of ["", "-journal", "-shm", "-wal"]) {
      const path = `${databasePath}${suffix}`;
      await removeIfExists(path);
    }
  };
}
