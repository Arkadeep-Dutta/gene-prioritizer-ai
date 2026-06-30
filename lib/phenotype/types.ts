export const PHENOTYPE_STATUSES = [
  "PRESENT",
  "NEGATED",
  "UNCERTAIN",
  "FAMILY_HISTORY",
  "UNMAPPED",
] as const;

export type PhenotypeStatus = (typeof PHENOTYPE_STATUSES)[number];

export type PhenotypeSpan = {
  start: number;
  end: number;
};

export type PhenotypeMetadata = {
  ageOfOnset: string | null;
  sex: string | null;
  inheritancePattern: string | null;
  warnings: string[];
};

export type PhenotypeMappingMethod =
  | "local_label"
  | "local_synonym"
  | "llm_candidate_local_verified"
  | "unmapped";

export type RawPhenotypeMention = {
  phrase: string;
  status: PhenotypeStatus;
  confidence: number;
  span?: PhenotypeSpan;
  sourceText: string;
  source: "deterministic" | "llm";
  proposedHpoId?: string | null;
  warnings: string[];
};

export type HpoMappedPhenotype = {
  hpoId: string | null;
  label: string | null;
  status: PhenotypeStatus;
  confidence: number;
  sourceText: string;
  span?: PhenotypeSpan;
  mappingMethod: PhenotypeMappingMethod;
  isObsolete?: boolean;
  definition?: string | null;
  alternatives: Array<{
    hpoId: string;
    label: string;
    confidence: number;
    mappingMethod: PhenotypeMappingMethod;
  }>;
  warnings: string[];
};

export type PhenotypeExtractionMethod = "deterministic" | "llm" | "llm_with_deterministic_fallback";

export type PhenotypeExtractionResult = {
  extractionId: null;
  method: PhenotypeExtractionMethod;
  requiresConfirmation: boolean;
  terms: HpoMappedPhenotype[];
  negatedTerms: HpoMappedPhenotype[];
  uncertainTerms: HpoMappedPhenotype[];
  familyHistoryTerms: HpoMappedPhenotype[];
  unmappedTerms: HpoMappedPhenotype[];
  metadata: PhenotypeMetadata;
  confirmedHpoTermsForRanking: string[];
  warnings: string[];
  disclaimer: string;
};
