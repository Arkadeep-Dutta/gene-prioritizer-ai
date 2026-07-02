import { readFile } from "node:fs/promises";

import { parseGeneAssociationTsvText } from "./parse-tsv";
import type { HpoAssociationParseOptions, ParsedGeneAssociations } from "./types";

export function parseGenesToPhenotypeText(
  text: string,
  options: HpoAssociationParseOptions = {},
): ParsedGeneAssociations {
  return parseGeneAssociationTsvText(text, "genes_to_phenotype.txt", options);
}

export async function parseGenesToPhenotypeFile(
  path: string,
  options: HpoAssociationParseOptions = {},
): Promise<ParsedGeneAssociations> {
  return parseGenesToPhenotypeText(await readFile(path, "utf8"), options);
}
