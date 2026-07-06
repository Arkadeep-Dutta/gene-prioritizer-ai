import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const apiRoutes = [
  "app/api/phenotype/extract/route.ts",
  "app/api/prioritize/route.ts",
  "app/api/literature/search/route.ts",
  "app/api/hpo/search/route.ts",
];

describe("API route privacy logging", () => {
  it("does not log raw phenotype or free-text request bodies", () => {
    for (const route of apiRoutes) {
      const source = readFileSync(join(process.cwd(), route), "utf8");
      expect(source).not.toMatch(/console\.(log|info|warn|error|debug)\s*\(/);
      expect(source).not.toContain("LOG_RAW_INPUTS");
      expect(source).not.toContain("LOG_REQUEST_BODIES");
    }
  });
});
