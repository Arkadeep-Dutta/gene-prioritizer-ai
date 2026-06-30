import { getLlmConfig } from "./config";
import { LlmExtractionError } from "./errors";
import { buildPhenotypeExtractionPrompt } from "./prompts";
import { validateLlmPhenotypeMentions } from "./schema";
import type { LlmConfig, LlmPhenotypeProvider } from "./types";

export function shouldUseExternalLlm(input: {
  requested: boolean;
  allowExternalLlm: boolean;
  config?: LlmConfig;
}): { allowed: boolean; warnings: string[]; config: LlmConfig } {
  const config = input.config ?? getLlmConfig();
  const warnings: string[] = [];

  if (!input.requested) return { allowed: false, warnings, config };
  if (config.disabled) {
    warnings.push(
      "LLM extraction was requested, but DISABLE_LLM=true; deterministic fallback used.",
    );
    return { allowed: false, warnings, config };
  }
  if (!input.allowExternalLlm) {
    warnings.push("External LLM extraction is not enabled; deterministic fallback used.");
    return { allowed: false, warnings, config };
  }
  if (config.provider === "none") {
    warnings.push("No LLM provider is configured; deterministic fallback used.");
    return { allowed: false, warnings, config };
  }
  if (!config.apiKeyConfigured) {
    warnings.push(
      "The configured LLM provider is missing a server-side API key; deterministic fallback used.",
    );
    return { allowed: false, warnings, config };
  }
  return {
    allowed: true,
    warnings: [
      "External LLM extraction was used; submitted text may have been transmitted to the configured provider.",
    ],
    config,
  };
}

export function getConfiguredLlmProvider(config: LlmConfig): LlmPhenotypeProvider {
  if (config.provider === "mock") {
    throw new LlmExtractionError(
      "Mock LLM provider must be injected by tests.",
      "LLM_PROVIDER_MISSING",
    );
  }

  throw new LlmExtractionError(
    "Live LLM provider integration is not implemented in Phase 6; deterministic fallback used.",
    "LLM_PROVIDER_NOT_IMPLEMENTED",
  );
}

export async function runLlmPhenotypeExtraction(input: {
  text: string;
  provider: LlmPhenotypeProvider;
  config: LlmConfig;
}) {
  const raw = await input.provider.extractPhenotypes({
    text: input.text.slice(0, input.config.maxInputChars),
    prompt: buildPhenotypeExtractionPrompt(),
    config: input.config,
  });
  return validateLlmPhenotypeMentions(raw);
}
