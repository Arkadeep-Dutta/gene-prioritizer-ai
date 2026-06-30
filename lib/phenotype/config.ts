export type PhenotypeExtractionConfig = {
  textMaxChars: number;
  maxExtractedTerms: number;
  searchLimitPerPhrase: number;
  requireConfirmation: boolean;
  allowExternalLlm: boolean;
};

const DEFAULTS: PhenotypeExtractionConfig = {
  textMaxChars: 8_000,
  maxExtractedTerms: 100,
  searchLimitPerPhrase: 10,
  requireConfirmation: true,
  allowExternalLlm: false,
};

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

export function getPhenotypeExtractionConfig(
  environment: NodeJS.ProcessEnv = process.env,
): PhenotypeExtractionConfig {
  return {
    textMaxChars: readPositiveInt(environment.PHENOTYPE_TEXT_MAX_CHARS, DEFAULTS.textMaxChars),
    maxExtractedTerms: readPositiveInt(
      environment.PHENOTYPE_MAX_EXTRACTED_TERMS,
      DEFAULTS.maxExtractedTerms,
    ),
    searchLimitPerPhrase: readPositiveInt(
      environment.PHENOTYPE_SEARCH_LIMIT_PER_PHRASE,
      DEFAULTS.searchLimitPerPhrase,
    ),
    requireConfirmation: readBoolean(
      environment.PHENOTYPE_REQUIRE_CONFIRMATION,
      DEFAULTS.requireConfirmation,
    ),
    allowExternalLlm: readBoolean(
      environment.PHENOTYPE_ALLOW_EXTERNAL_LLM,
      DEFAULTS.allowExternalLlm,
    ),
  };
}
