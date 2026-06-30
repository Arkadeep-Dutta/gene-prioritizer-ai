import { describe, expect, it } from "vitest";

import { parseLlmJsonObject } from "@/lib/llm/json";

describe("LLM JSON parsing", () => {
  it("parses strict JSON and extracts a single JSON object from surrounding text", () => {
    expect(parseLlmJsonObject('{"mentions":[]}')).toEqual({ mentions: [] });
    expect(parseLlmJsonObject('JSON:\n{"mentions":[]}\nDone')).toEqual({ mentions: [] });
  });

  it("rejects malformed JSON", () => {
    expect(() => parseLlmJsonObject("not json")).toThrow("malformed JSON");
  });
});
