export type PubMedArticle = {
  pmid: string;
  doi: string | null;
  title: string;
  abstract: string | null;
  journal: string | null;
  publicationYear: number | null;
  authors: string[];
  url: string;
  sourceName: "PubMed";
  fetchedAt: string;
  summary?: string | null;
};

export type LiteratureQuery = {
  geneSymbol: string;
  hpoTerms: string[];
  query: string;
  queryType: "gene_phenotype" | "gene_only";
  pmids: string[];
};

export type LiteratureSearchRequest = {
  geneSymbols: string[];
  hpoTerms: string[];
  retmax: number;
  includeAbstracts: boolean;
  summarize: boolean;
};

export type LiteratureSearchResult = {
  queries: LiteratureQuery[];
  records: PubMedArticle[];
  warnings: string[];
};

export type LiteratureEvidenceForGene = {
  geneSymbol: string;
  literatureBoost: number;
  records: PubMedArticle[];
  queries: LiteratureQuery[];
  warnings: string[];
};

export type NcbiClientConfig = {
  baseUrl: string;
  apiKey: string;
  email: string;
  tool: string;
  timeoutMs: number;
  retries: number;
  rateLimitRpsNoKey: number;
  rateLimitRpsWithKey: number;
};
