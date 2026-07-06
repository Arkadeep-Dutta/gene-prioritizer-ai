import { describe, expect, it } from "vitest";

import { getLlmConfig } from "@/lib/llm/config";

describe("external LLM defaults", () => {
  it("keeps external LLM extraction disabled without explicit opt-in", () => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DISABLE_LLM: undefined,
      LLM_PROVIDER: undefined,
      OPENAI_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
      GEMINI_API_KEY: undefined,
    };

    const config = getLlmConfig(env);

    expect(config.disabled).toBe(true);
    expect(config.provider).toBe("none");
    expect(config.apiKeyConfigured).toBe(false);
  });
});
