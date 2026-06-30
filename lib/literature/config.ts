import type { NcbiClientConfig } from "./types";

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export type LiteratureConfig = {
  enabled: boolean;
  defaultRetmax: number;
  maxRetmax: number;
  cacheTtlSeconds: number;
  maxQueryLength: number;
  attachToRankingDefault: boolean;
  rankingBoostMax: number;
  rankingEnrichedGeneLimit: number;
  summariesEnabled: boolean;
  summaryMaxArticles: number;
};

export function getNcbiConfig(environment: NodeJS.ProcessEnv = process.env): NcbiClientConfig {
  return {
    baseUrl: environment.NCBI_EUTILS_BASE_URL ?? "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
    apiKey: environment.NCBI_API_KEY ?? "",
    email: environment.NCBI_EMAIL ?? "",
    tool: environment.NCBI_TOOL_NAME ?? "gene-prioritizer-ai",
    timeoutMs: positiveInt(environment.NCBI_REQUEST_TIMEOUT_MS, 30_000),
    retries: positiveInt(environment.NCBI_REQUEST_RETRIES, 2),
    rateLimitRpsNoKey: positiveNumber(environment.NCBI_RATE_LIMIT_RPS_NO_KEY, 3),
    rateLimitRpsWithKey: positiveNumber(environment.NCBI_RATE_LIMIT_RPS_WITH_KEY, 10),
  };
}

export function getLiteratureConfig(
  environment: NodeJS.ProcessEnv = process.env,
): LiteratureConfig {
  const maxRetmax = positiveInt(environment.LITERATURE_MAX_RETMAX, 25);
  return {
    enabled: environment.LITERATURE_ENABLED !== "false",
    defaultRetmax: Math.min(positiveInt(environment.LITERATURE_DEFAULT_RETMAX, 10), maxRetmax),
    maxRetmax,
    cacheTtlSeconds: positiveInt(environment.LITERATURE_CACHE_TTL_SECONDS, 86_400),
    maxQueryLength: positiveInt(environment.LITERATURE_MAX_QUERY_LENGTH, 500),
    attachToRankingDefault: environment.LITERATURE_ATTACH_TO_RANKING_DEFAULT === "true",
    rankingBoostMax: positiveInt(environment.LITERATURE_RANKING_BOOST_MAX, 5),
    rankingEnrichedGeneLimit: positiveInt(environment.LITERATURE_RANKING_GENE_LIMIT, 5),
    summariesEnabled: environment.LITERATURE_LLM_SUMMARIES_ENABLED === "true",
    summaryMaxArticles: positiveInt(environment.LITERATURE_SUMMARY_MAX_ARTICLES, 5),
  };
}
