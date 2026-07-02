export type AppEnvironment = "development" | "test" | "production";

function boolFromEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "true";
}

function intFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getAppEnvironment(): AppEnvironment {
  const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";
  return appEnv === "production" || appEnv === "test" ? appEnv : "development";
}

export function getSecurityConfig() {
  return {
    appEnv: getAppEnvironment(),
    securityHeadersEnabled: boolFromEnv(process.env.SECURITY_HEADERS_ENABLED, true),
    cspEnabled: boolFromEnv(process.env.CSP_ENABLED, true),
    cspReportOnly: boolFromEnv(process.env.CSP_REPORT_ONLY, false),
    trustedOrigins: (process.env.TRUSTED_ORIGINS ?? "http://localhost:3000")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    maxJsonBodyBytes: intFromEnv(process.env.MAX_JSON_BODY_BYTES, 1_048_576),
    maxFreeTextChars: intFromEnv(
      process.env.MAX_FREE_TEXT_CHARS ?? process.env.PHENOTYPE_TEXT_MAX_CHARS,
      8_000,
    ),
    maxHpoTerms: intFromEnv(process.env.MAX_HPO_TERMS ?? process.env.RANKING_HPO_TERM_LIMIT, 100),
    maxCandidateGenes: intFromEnv(
      process.env.MAX_CANDIDATE_GENES ?? process.env.RANKING_CANDIDATE_GENE_LIMIT,
      500,
    ),
    maxLiteratureGenes: intFromEnv(process.env.MAX_LITERATURE_GENES, 25),
    maxExportResults: intFromEnv(process.env.MAX_EXPORT_RESULTS, 500),
    logRawInputs: boolFromEnv(process.env.LOG_RAW_INPUTS, false),
    logRequestBodies: boolFromEnv(process.env.LOG_REQUEST_BODIES, false),
    auditAdminActions: boolFromEnv(process.env.AUDIT_ADMIN_ACTIONS, true),
    privacyModeDefault: boolFromEnv(
      process.env.PRIVACY_MODE_DEFAULT ?? process.env.RANKING_PRIVACY_MODE_DEFAULT,
      true,
    ),
  };
}

export function getRateLimitConfig() {
  return {
    enabled: boolFromEnv(process.env.RATE_LIMIT_ENABLED, false),
    backend: process.env.RATE_LIMIT_BACKEND ?? "memory",
    windowSeconds: intFromEnv(process.env.RATE_LIMIT_WINDOW_SECONDS, 60),
    defaultMaxRequests: intFromEnv(process.env.RATE_LIMIT_DEFAULT_MAX_REQUESTS, 60),
    prioritizeMaxRequests: intFromEnv(process.env.RATE_LIMIT_PRIORITIZE_MAX_REQUESTS, 20),
    phenotypeExtractMaxRequests: intFromEnv(
      process.env.RATE_LIMIT_PHENOTYPE_EXTRACT_MAX_REQUESTS,
      20,
    ),
    literatureMaxRequests: intFromEnv(process.env.RATE_LIMIT_LITERATURE_MAX_REQUESTS, 10),
    geneValidateMaxRequests: intFromEnv(process.env.RATE_LIMIT_GENE_VALIDATE_MAX_REQUESTS, 30),
    adminMaxRequests: intFromEnv(process.env.RATE_LIMIT_ADMIN_MAX_REQUESTS, 5),
  };
}
