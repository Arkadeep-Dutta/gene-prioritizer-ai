export const HPO_SOURCE_FILES = {
  ontology: {
    fileName: "hp.obo",
    url: "https://purl.obolibrary.org/obo/hp.obo",
    minBytes: 1024,
  },
  phenotypeToGenes: {
    fileName: "phenotype_to_genes.txt",
    url: "https://github.com/obophenotype/human-phenotype-ontology/releases/latest/download/phenotype_to_genes.txt",
    minBytes: 128,
  },
  genesToPhenotype: {
    fileName: "genes_to_phenotype.txt",
    url: "https://github.com/obophenotype/human-phenotype-ontology/releases/latest/download/genes_to_phenotype.txt",
    minBytes: 128,
  },
} as const;

export const HPO_APPROVED_DOWNLOAD_URLS: Set<string> = new Set(
  Object.values(HPO_SOURCE_FILES).map((source) => source.url),
);

export const HPO_SOURCE_NAMES = {
  ontology: "HPOOntology",
  geneAssociations: "HPOGeneAssociations",
} as const;

export const DEFAULT_HPO_DATA_DIR = "./data/hpo";
export const DEFAULT_HPO_DOWNLOAD_TIMEOUT_MS = 30_000;
export const DEFAULT_HPO_DOWNLOAD_RETRIES = 3;
export const DEFAULT_HPO_IMPORT_BATCH_SIZE = 1_000;
export const MAX_HPO_SEARCH_LIMIT = 50;
export const DEFAULT_HPO_SEARCH_LIMIT = 20;
export const MAX_HPO_QUERY_LENGTH = 100;
export const MAX_DOWNLOAD_BYTES = 250 * 1024 * 1024;

export const HPO_IMPORT_MODES = ["fixture", "full"] as const;
export type HpoImportMode = (typeof HPO_IMPORT_MODES)[number];
export const DEFAULT_HPO_IMPORT_MODE: HpoImportMode = "fixture";
