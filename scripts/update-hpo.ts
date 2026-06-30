import "dotenv/config";

import { prisma } from "../lib/db/prisma";
import { downloadHpoSources } from "../lib/hpo/download";
import { buildHpoData } from "./build-hpo";

async function main() {
  await downloadHpoSources({ force: process.argv.includes("--force") });
  await buildHpoData();
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
