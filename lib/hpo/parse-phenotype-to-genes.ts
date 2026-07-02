import { readFile } from "node:fs/promises";

import { parseGeneAssociationTsvText } from "./parse-tsv";
import type { HpoAssociationParseOptions, ParsedGeneAssociations } from "./types";

export function parsePhenotypeToGenesText(
  text: string,
  options: HpoAssociationParseOptions = {},
): ParsedGeneAssociations {
  return parseGeneAssociationTsvText(text, "phenotype_to_genes.txt", options);
}

export async function parsePhenotypeToGenesFile(
  path: string,
  options: HpoAssociationParseOptions = {},
): Promise<ParsedGeneAssociations> {
  return parsePhenotypeToGenesText(await readFile(path, "utf8"), options);
}
