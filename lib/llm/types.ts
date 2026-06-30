export type LlmProviderName = "none" | "openai" | "anthropic" | "gemini" | "mock";

export type LlmConfig = {
  provider: LlmProviderName;
  model: string;
  disabled: boolean;
  timeoutMs: number;
  retries: number;
  maxInputChars: number;
  apiKeyConfigured: boolean;
};

export type LlmPhenotypeProvider = {
  extractPhenotypes(input: { text: string; prompt: string; config: LlmConfig }): Promise<unknown>;
};
