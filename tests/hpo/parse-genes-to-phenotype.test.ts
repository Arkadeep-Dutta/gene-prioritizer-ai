import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parseGenesToPhenotypeText } from "@/lib/hpo/parse-genes-to-phenotype";

const fixturePath = resolve(process.cwd(), "tests/fixtures/hpo/genes_to_phenotype.fixture.txt");

describe("parseGenesToPhenotypeText", () => {
  it("parses genes-to-phenotype rows", async () => {
    const parsed = parseGenesToPhenotypeText(await readFile(fixturePath, "utf8"));

    expect(parsed.associations).toHaveLength(4);
    expect(parsed.associations).toContainEqual(
      expect.objectContaining({
        geneSymbol: "CACNA1A",
        hpoId: "HP:0001252",
        hpoLabel: "Hypotonia",
        diseaseId: "OMIM:604315",
      }),
    );
  });
});
