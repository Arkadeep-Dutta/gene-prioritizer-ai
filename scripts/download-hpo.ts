import "dotenv/config";

import { downloadHpoSources } from "../lib/hpo/download";

async function main() {
  const files = await downloadHpoSources({ force: process.argv.includes("--force") });
  for (const file of files) {
    console.log(
      `${file.skipped ? "cached" : "downloaded"} ${file.fileName} (${file.bytes} bytes, sha256=${file.sha256})`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
