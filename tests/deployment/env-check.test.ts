import { describe, expect, it } from "vitest";

import {
  assertSafeProductionConfig,
  getDeploymentConfig,
  getDeploymentWarnings,
  validateProductionEnvironment,
} from "@/lib/deployment/env-check";

function env(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    APP_ENV: "production",
    DATABASE_URL: "postgresql://user:secret@example.test:5432/db",
    NEXT_PUBLIC_APP_URL: "https://gene-prio.example",
    ADMIN_INGEST_SECRET: "rotated-secret",
    RATE_LIMIT_BACKEND: "redis",
    SECURITY_HEADERS_ENABLED: "true",
    CSP_ENABLED: "true",
    LOG_RAW_INPUTS: "false",
    LOG_REQUEST_BODIES: "false",
    DISABLE_LLM: "true",
    GENE_CARDS_LICENSED_IMPORT_ENABLED: "false",
    ...overrides,
  } as unknown as NodeJS.ProcessEnv;
}

describe("deployment environment checks", () => {
  it("passes a safe production-like configuration without exposing secret values", () => {
    const result = validateProductionEnvironment(env());

    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain("rotated-secret");
    expect(JSON.stringify(result)).not.toContain("postgresql://user:secret");
  });

  it("blocks default admin secret in production", () => {
    const result = validateProductionEnvironment(
      env({ ADMIN_INGEST_SECRET: "change-me-in-production" }),
    );

    expect(result.ok).toBe(false);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "ADMIN_SECRET_UNSAFE" })]),
    );
    expect(() =>
      assertSafeProductionConfig(env({ ADMIN_INGEST_SECRET: "change-me-in-production" })),
    ).toThrow("ADMIN_SECRET_UNSAFE");
  });

  it("warns on SQLite, raw logging, memory rate limiting, disabled headers, and LLM misconfig", () => {
    const warnings = getDeploymentWarnings(
      env({
        DATABASE_URL: "file:./prod.db",
        DEPLOYMENT_TARGET: "vercel",
        RATE_LIMIT_BACKEND: "memory",
        LOG_RAW_INPUTS: "true",
        LOG_REQUEST_BODIES: "true",
        SECURITY_HEADERS_ENABLED: "false",
        CSP_ENABLED: "false",
        DISABLE_LLM: "false",
        LLM_PROVIDER: "openai",
        OPENAI_API_KEY: "",
        NEXT_PUBLIC_APP_URL: "",
      }),
    );

    expect(warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        "PRODUCTION_DATABASE_NOT_POSTGRESQL",
        "MEMORY_RATE_LIMIT_MULTI_INSTANCE",
        "RAW_INPUT_LOGGING_ENABLED",
        "REQUEST_BODY_LOGGING_ENABLED",
        "SECURITY_HEADERS_DISABLED",
        "CSP_DISABLED",
        "LLM_ENABLED_WITHOUT_PROVIDER_KEY",
        "NEXT_PUBLIC_APP_URL_MISSING",
      ]),
    );
  });

  it("requires explicit acknowledgement when licensed GeneCards import is enabled", () => {
    const warnings = getDeploymentWarnings(
      env({
        GENE_CARDS_LICENSED_IMPORT_ENABLED: "true",
        GENE_CARDS_LICENSE_ACKNOWLEDGED: "false",
      }),
    );

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "GENECARDS_LICENSE_ACKNOWLEDGEMENT_MISSING" }),
      ]),
    );
  });

  it("summarizes deployment config without secret values", () => {
    const config = getDeploymentConfig(env({ BUILD_COMMIT_SHA: "abc123" }));

    expect(config.databaseProvider).toBe("postgresql");
    expect(config.build.buildCommitSha).toBe("abc123");
    expect(JSON.stringify(config)).not.toContain("rotated-secret");
  });
});
