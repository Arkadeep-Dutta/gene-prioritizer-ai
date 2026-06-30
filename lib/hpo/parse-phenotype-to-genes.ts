import { readFile } from "node:fs/promises";

import { parseGeneAssociationTsvText } from "./parse-tsv";
import type { ParsedGeneAssociations } from "./types";

export function parsePhenotypeToGenesText(text: string): ParsedGeneAssociations {
  return parseGeneAssociationTsvText(text, "phenotype_to_genes.txt");
}

export async function parsePhenotypeToGenesFile(path: string): Promise<ParsedGeneAssociations> {
  return parsePhenotypeToGenesText(await readFile(path, "utf8"));
}
