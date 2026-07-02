import { getGeneCardsImportConfig } from "@/lib/genecards/config";
import { getLlmConfig } from "@/lib/llm/config";

import { getBuildInfo, type BuildInfo } from "./build-info";

const DEFAULT_ADMIN_SECRET = "change-me-in-production";

export type DeploymentSeverity = "error" | "warning";

export type DeploymentWarning = {
  code: string;
  severity: DeploymentSeverity;
  message: string;
};

export type DeploymentConfig = {
  appEnv: "development" | "test" | "production";
  nodeEnv: string;
  deploymentTarget: string;
  databaseProvider: "sqlite" | "postgresql" | "unknown";
  rateLimitBackend: string;
  securityHeadersEnabled: boolean;
  cspEnabled: boolean;
  logRawInputs: boolean;
  logRequestBodies: boolean;
  geneCardsLicensedImportEnabled: boolean;
  llmDisabled: boolean;
  llmProvider: string;
  llmApiKeyConfigured: boolean;
  nextPublicAppUrlConfigured: boolean;
  adminSecretConfigured: boolean;
  adminSecretDefault: boolean;
  build: BuildInfo;
};

function boolFromEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "true";
}

function readAppEnv(environment: NodeJS.ProcessEnv): DeploymentConfig["appEnv"] {
  const appEnv = environment.APP_ENV || environment.NODE_ENV || "development";
  return appEnv === "production" || appEnv === "test" ? appEnv : "development";
}

function databaseProvider(databaseUrl: string | undefined): DeploymentConfig["databaseProvider"] {
  const normalized = databaseUrl?.trim().toLowerCase() ?? "";
  if (normalized.startsWith("file:")) return "sqlite";
  if (normalized.startsWith("postgres://") || normalized.startsWith("postgresql://")) {
    return "postgresql";
  }
  return "unknown";
}

export function getDeploymentConfig(
  environment: NodeJS.ProcessEnv = process.env,
): DeploymentConfig {
  const llm = getLlmConfig(environment);
  const geneCards = getGeneCardsImportConfig(environment);
  const adminSecret = environment.ADMIN_INGEST_SECRET?.trim() ?? "";

  return {
    appEnv: readAppEnv(environment),
    nodeEnv: environment.NODE_ENV ?? "development",
    deploymentTarget: environment.DEPLOYMENT_TARGET?.trim() || "local",
    databaseProvider: databaseProvider(environment.DATABASE_URL),
    rateLimitBackend: environment.RATE_LIMIT_BACKEND ?? "memory",
    securityHeadersEnabled: boolFromEnv(environment.SECURITY_HEADERS_ENABLED, true),
    cspEnabled: boolFromEnv(environment.CSP_ENABLED, true),
    logRawInputs: boolFromEnv(environment.LOG_RAW_INPUTS, false),
    logRequestBodies: boolFromEnv(environment.LOG_REQUEST_BODIES, false),
    geneCardsLicensedImportEnabled: geneCards.licensedImportEnabled,
    llmDisabled: llm.disabled,
    llmProvider: llm.provider,
    llmApiKeyConfigured: llm.apiKeyConfigured,
    nextPublicAppUrlConfigured: Boolean(environment.NEXT_PUBLIC_APP_URL?.trim()),
    adminSecretConfigured: Boolean(adminSecret),
    adminSecretDefault: adminSecret === DEFAULT_ADMIN_SECRET,
    build: getBuildInfo(environment),
  };
}

export function getDeploymentWarnings(
  environment: NodeJS.ProcessEnv = process.env,
): DeploymentWarning[] {
  const config = getDeploymentConfig(environment);
  const warnings: DeploymentWarning[] = [];
  const isProduction = config.appEnv === "production";
  const multiInstance =
    isProduction &&
    !["local", "docker", "single-node"].includes(config.deploymentTarget.toLowerCase());

  if (isProduction && (!config.adminSecretConfigured || config.adminSecretDefault)) {
    warnings.push({
      code: "ADMIN_SECRET_UNSAFE",
      severity: "error",
      message: "Production admin endpoints require a rotated ADMIN_INGEST_SECRET.",
    });
  }

  if (isProduction && config.databaseProvider !== "postgresql") {
    warnings.push({
      code: "PRODUCTION_DATABASE_NOT_POSTGRESQL",
      severity: "warning",
      message: "Production deployments should use PostgreSQL DATABASE_URL, not SQLite.",
    });
  }

  if (multiInstance && config.rateLimitBackend === "memory") {
    warnings.push({
      code: "MEMORY_RATE_LIMIT_MULTI_INSTANCE",
      severity: "warning",
      message: "Memory rate limiting is per instance; use a shared backend for public production.",
    });
  }

  if (isProduction && config.logRawInputs) {
    warnings.push({
      code: "RAW_INPUT_LOGGING_ENABLED",
      severity: "warning",
      message: "LOG_RAW_INPUTS should remain false in production.",
    });
  }

  if (isProduction && config.logRequestBodies) {
    warnings.push({
      code: "REQUEST_BODY_LOGGING_ENABLED",
      severity: "warning",
      message: "LOG_REQUEST_BODIES should remain false in production.",
    });
  }

  if (isProduction && config.geneCardsLicensedImportEnabled) {
    const acknowledged = boolFromEnv(environment.GENE_CARDS_LICENSE_ACKNOWLEDGED, false);
    warnings.push({
      code: acknowledged
        ? "GENECARDS_LICENSED_IMPORT_ENABLED"
        : "GENECARDS_LICENSE_ACKNOWLEDGEMENT_MISSING",
      severity: acknowledged ? "warning" : "error",
      message:
        "Licensed GeneCards/GeneALaCart import is enabled; confirm license rights and retention controls.",
    });
  }

  if (isProduction && !config.llmDisabled && (!config.llmProvider || !config.llmApiKeyConfigured)) {
    warnings.push({
      code: "LLM_ENABLED_WITHOUT_PROVIDER_KEY",
      severity: "warning",
      message: "DISABLE_LLM=false requires a configured provider and server-side API key.",
    });
  }

  if (isProduction && !config.nextPublicAppUrlConfigured) {
    warnings.push({
      code: "NEXT_PUBLIC_APP_URL_MISSING",
      severity: "warning",
      message: "NEXT_PUBLIC_APP_URL should be set to the deployed app origin.",
    });
  }

  if (isProduction && !config.securityHeadersEnabled) {
    warnings.push({
      code: "SECURITY_HEADERS_DISABLED",
      severity: "warning",
      message: "SECURITY_HEADERS_ENABLED should remain true in production.",
    });
  }

  if (isProduction && !config.cspEnabled) {
    warnings.push({
      code: "CSP_DISABLED",
      severity: "warning",
      message: "CSP_ENABLED should remain true in production.",
    });
  }

  return warnings;
}

export function validateProductionEnvironment(environment: NodeJS.ProcessEnv = process.env): {
  ok: boolean;
  warnings: DeploymentWarning[];
} {
  const warnings = getDeploymentWarnings(environment);
  return { ok: !warnings.some((warning) => warning.severity === "error"), warnings };
}

export function assertSafeProductionConfig(environment: NodeJS.ProcessEnv = process.env): void {
  const result = validateProductionEnvironment(environment);
  if (!result.ok) {
    throw new Error(
      `Unsafe production deployment configuration: ${result.warnings
        .filter((warning) => warning.severity === "error")
        .map((warning) => warning.code)
        .join(", ")}`,
    );
  }
}
