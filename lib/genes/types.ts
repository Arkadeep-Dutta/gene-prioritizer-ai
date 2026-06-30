export const GENE_VALIDATION_STATUSES = [
  "VALIDATED",
  "ALIAS_RESOLVED",
  "PREVIOUS_SYMBOL_RESOLVED",
  "INVALID",
  "UNVALIDATED",
  "UNKNOWN",
] as const;

export type GeneValidationStatus = (typeof GENE_VALIDATION_STATUSES)[number];

export type GeneMatchedField = "symbol" | "alias_symbol" | "prev_symbol" | "cache" | null;

export type HgncRecord = {
  symbol: string;
  hgncId: string;
  name: string | null;
  status: string | null;
  aliases: string[];
  previousSymbols: string[];
  ensemblId: string | null;
  entrezId: string | null;
};

export type GeneLinkouts = {
  hgnc?: string;
  ncbiGene?: string;
  ensembl?: string;
  clinVarSearch: string;
  pubMedSearch: string;
  geneCards?: string;
};

export type GeneValidationResult = {
  input: string;
  normalizedInput: string | null;
  status: GeneValidationStatus;
  canonicalSymbol: string | null;
  matchedField: GeneMatchedField;
  hgncId: string | null;
  name: string | null;
  entrezId: string | null;
  ncbiGeneId: string | null;
  ensemblId: string | null;
  aliases: string[];
  previousSymbols: string[];
  links: GeneLinkouts | null;
  warnings: string[];
};

export type GeneValidationSummary = {
  total: number;
  validated: number;
  aliasResolved: number;
  previousSymbolResolved: number;
  invalid: number;
  unvalidated: number;
  unknown: number;
};

export type ParsedGeneInput = {
  original: string;
  normalized: string | null;
  validFormat: boolean;
};

export type HgncClientOptions = {
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
  fetchFn?: typeof fetch;
};

export type GeneValidationOptions = {
  useCache?: boolean;
  hgncClient?: HgncResolver;
};

export type HgncResolver = {
  resolveHgncSymbol(symbol: string): Promise<GeneValidationResult>;
};
