import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { HpoParseError } from "@/lib/hpo/errors";
import { parsePhenotypeToGenesText } from "@/lib/hpo/parse-phenotype-to-genes";

const fixturePath = resolve(process.cwd(), "tests/fixtures/hpo/phenotype_to_genes.fixture.txt");

describe("parsePhenotypeToGenesText", () => {
  it("parses phenotype-to-gene rows and removes duplicates", async () => {
    const parsed = parsePhenotypeToGenesText(await readFile(fixturePath, "utf8"));

    expect(parsed.associations).toHaveLength(3);
    expect(parsed.associations[0]).toMatchObject({
      geneSymbol: "SCN2A",
      hpoId: "HP:0001250",
      diseaseId: "OMIM:613721",
      diseaseName: "Developmental and epileptic encephalopathy",
      evidenceCode: "PCS",
      reference: "PMID:00000001",
    });
  });

  it("rejects missing required headers and malformed HPO IDs", () => {
    expect(() => parsePhenotypeToGenesText("gene_symbol\tlabel\nSCN2A\tSeizure")).toThrow(
      HpoParseError,
    );
    expect(() => parsePhenotypeToGenesText("gene_symbol\thpo_id\nSCN2A\tHP:1250")).toThrow(
      "Invalid HPO ID",
    );
  });
});
