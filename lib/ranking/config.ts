export type RankingConfig = {
  algorithmVersion: string;
  defaultLimit: number;
  maxLimit: number;
  candidateGeneLimit: number;
  hpoTermLimit: number;
  storeResultsDefault: boolean;
  privacyModeDefault: boolean;
  ancestorMaxDepth: number;
};

const DEFAULTS: RankingConfig = {
  algorithmVersion: "deterministic-hpo-v1",
  defaultLimit: 25,
  maxLimit: 100,
  candidateGeneLimit: 500,
  hpoTermLimit: 100,
  storeResultsDefault: true,
  privacyModeDefault: true,
  ancestorMaxDepth: 3,
};

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

export function getRankingConfig(environment: NodeJS.ProcessEnv = process.env): RankingConfig {
  const maxLimit = readPositiveInt(environment.RANKING_MAX_LIMIT, DEFAULTS.maxLimit);
  const defaultLimit = Math.min(
    readPositiveInt(environment.RANKING_DEFAULT_LIMIT, DEFAULTS.defaultLimit),
    maxLimit,
  );

  return {
    algorithmVersion: environment.RANKING_ALGORITHM_VERSION ?? DEFAULTS.algorithmVersion,
    defaultLimit,
    maxLimit,
    candidateGeneLimit: readPositiveInt(
      environment.RANKING_CANDIDATE_GENE_LIMIT,
      DEFAULTS.candidateGeneLimit,
    ),
    hpoTermLimit: readPositiveInt(environment.RANKING_HPO_TERM_LIMIT, DEFAULTS.hpoTermLimit),
    storeResultsDefault: readBoolean(
      environment.RANKING_STORE_RESULTS_DEFAULT,
      DEFAULTS.storeResultsDefault,
    ),
    privacyModeDefault: readBoolean(
      environment.RANKING_PRIVACY_MODE_DEFAULT,
      DEFAULTS.privacyModeDefault,
    ),
    ancestorMaxDepth: DEFAULTS.ancestorMaxDepth,
  };
}
