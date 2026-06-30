import { getLlmConfig } from "@/lib/llm/config";

import type { LiteratureConfig } from "./config";
import type { PubMedArticle } from "./types";

export function summarizeLiteratureRecords(
  articles: PubMedArticle[],
  requested: boolean,
  config: LiteratureConfig,
): { articles: PubMedArticle[]; warnings: string[] } {
  if (!requested) return { articles, warnings: [] };
  if (!config.summariesEnabled) {
    return {
      articles,
      warnings: ["Literature LLM summaries are disabled; returning citation metadata only."],
    };
  }
  const llmConfig = getLlmConfig();
  if (llmConfig.disabled || !llmConfig.apiKeyConfigured) {
    return {
      articles,
      warnings: ["Literature LLM summaries are unavailable; returning citation metadata only."],
    };
  }
  return {
    articles,
    warnings: [
      "Live literature LLM summarization is not implemented in Phase 7; returning citation metadata only.",
    ],
  };
}
