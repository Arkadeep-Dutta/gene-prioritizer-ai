import type { LlmConfig, LlmProviderName } from "./types";

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function providerApiKeyConfigured(
  provider: LlmProviderName,
  environment: NodeJS.ProcessEnv,
): boolean {
  if (provider === "openai") return Boolean(environment.OPENAI_API_KEY);
  if (provider === "anthropic") return Boolean(environment.ANTHROPIC_API_KEY);
  if (provider === "gemini") return Boolean(environment.GEMINI_API_KEY);
  if (provider === "mock") return true;
  return false;
}

function readProvider(value: string | undefined): LlmProviderName {
  if (value === "openai" || value === "anthropic" || value === "gemini" || value === "mock") {
    return value;
  }
  return "none";
}

export function getLlmConfig(environment: NodeJS.ProcessEnv = process.env): LlmConfig {
  const provider = readProvider(environment.LLM_PROVIDER);
  return {
    provider,
    model: environment.LLM_MODEL ?? "",
    disabled: environment.DISABLE_LLM !== "false",
    timeoutMs: readPositiveInt(environment.LLM_REQUEST_TIMEOUT_MS, 30_000),
    retries: readPositiveInt(environment.LLM_REQUEST_RETRIES, 1),
    maxInputChars: readPositiveInt(environment.LLM_MAX_INPUT_CHARS, 8_000),
    apiKeyConfigured: providerApiKeyConfigured(provider, environment),
  };
}
