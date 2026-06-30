import { readFile } from "node:fs/promises";

import { parseGeneAssociationTsvText } from "./parse-tsv";
import type { ParsedGeneAssociations } from "./types";

export function parseGenesToPhenotypeText(text: string): ParsedGeneAssociations {
  return parseGeneAssociationTsvText(text, "genes_to_phenotype.txt");
}

export async function parseGenesToPhenotypeFile(path: string): Promise<ParsedGeneAssociations> {
  return parseGenesToPhenotypeText(await readFile(path, "utf8"));
}
