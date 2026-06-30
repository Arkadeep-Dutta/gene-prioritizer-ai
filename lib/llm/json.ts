import { LlmExtractionError } from "./errors";

export function parseLlmJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      } catch {
        // fall through
      }
    }
  }

  throw new LlmExtractionError("LLM returned malformed JSON.", "LLM_JSON_INVALID");
}
