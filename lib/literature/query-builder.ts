import { parseGeneSymbolInput } from "@/lib/genes/normalize";

import type { LiteratureConfig } from "./config";
import { getLiteratureConfig } from "./config";
import { LiteratureError } from "./errors";

export type PubMedQueryInput = {
  geneSymbol: string;
  hpoTerms?: Array<{ hpoId: string; label: string; synonyms?: string[] }>;
  maxPhenotypeTerms?: number;
  includeHumanFilter?: boolean;
  geneOnly?: boolean;
};

function sanitizePhrase(value: string): string {
  return value
    .replace(/["\\()[\]{}:]/g, " ")
    .replace(/\b(AND|OR|NOT)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function termClause(value: string): string {
  return `"${sanitizePhrase(value)}"[Title/Abstract]`;
}

export function normalizeLiteratureGeneSymbol(rawGene: string): string {
  const [parsed] = parseGeneSymbolInput([rawGene]);
  if (!parsed?.validFormat || !parsed.normalized) {
    throw new LiteratureError("A valid gene symbol is required.", "GENE_SYMBOL_INVALID", 400);
  }
  return parsed.normalized;
}

export function buildPubMedQuery(
  input: PubMedQueryInput,
  config: LiteratureConfig = getLiteratureConfig(),
): { query: string; hpoTerms: string[]; queryType: "gene_phenotype" | "gene_only" } {
  const geneSymbol = normalizeLiteratureGeneSymbol(input.geneSymbol);
  const geneClause = termClause(geneSymbol);
  const maxTerms = Math.max(0, input.maxPhenotypeTerms ?? 3);
  const selectedTerms = (input.hpoTerms ?? [])
    .filter((term) => term.label.trim().length > 0)
    .slice(0, maxTerms);

  let query = geneClause;
  let queryType: "gene_phenotype" | "gene_only" = "gene_only";
  if (!input.geneOnly && selectedTerms.length > 0) {
    const phenotypeClause = selectedTerms.map((term) => termClause(term.label)).join(" OR ");
    query = `${geneClause} AND (${phenotypeClause})`;
    queryType = "gene_phenotype";
  }
  if (input.includeHumanFilter) query = `${query} AND "humans"[MeSH Terms]`;
  if (query.length > config.maxQueryLength) {
    query = query.slice(0, config.maxQueryLength).replace(/\s+\S*$/, "");
  }

  return { query, hpoTerms: selectedTerms.map((term) => term.hpoId), queryType };
}
