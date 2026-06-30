import { describe, expect, it } from "vitest";

import { getLlmConfig } from "@/lib/llm/config";
import { getConfiguredLlmProvider, shouldUseExternalLlm } from "@/lib/llm/provider";

describe("LLM provider safety", () => {
  it("defaults to disabled none provider without requiring keys", () => {
    const config = getLlmConfig({} as NodeJS.ProcessEnv);

    expect(config).toMatchObject({
      provider: "none",
      disabled: true,
      apiKeyConfigured: false,
    });
  });

  it("DISABLE_LLM=true prevents provider calls", () => {
    const decision = shouldUseExternalLlm({
      requested: true,
      allowExternalLlm: true,
      config: {
        provider: "mock",
        model: "mock",
        disabled: true,
        timeoutMs: 1,
        retries: 0,
        maxInputChars: 100,
        apiKeyConfigured: true,
      },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.warnings.join(" ")).toContain("DISABLE_LLM=true");
  });

  it("provider missing or not implemented falls back safely", () => {
    expect(() =>
      getConfiguredLlmProvider({
        provider: "openai",
        model: "placeholder",
        disabled: false,
        timeoutMs: 1,
        retries: 0,
        maxInputChars: 100,
        apiKeyConfigured: true,
      }),
    ).toThrow("not implemented");
  });
});
