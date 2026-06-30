import { describe, expect, it } from "vitest";

import { normalizePhenotypeExtractInput } from "@/lib/phenotype/input";

const config = {
  textMaxChars: 20,
  maxExtractedTerms: 5,
  searchLimitPerPhrase: 3,
  requireConfirmation: true,
  allowExternalLlm: false,
};

describe("phenotype extraction input", () => {
  it("accepts valid text and caps maxTerms", () => {
    const input = normalizePhenotypeExtractInput(
      { text: " Infant with seizures ", maxTerms: 100, useLLM: false },
      config,
    );

    expect(input.text).toBe("Infant with seizures");
    expect(input.maxTerms).toBe(5);
    expect(input.useLLM).toBe(false);
  });

  it("rejects empty, too-long, non-string, and unsafe extra payload fields", () => {
    expect(() => normalizePhenotypeExtractInput({ text: " " }, config)).toThrow(
      "Phenotype extraction text is required",
    );
    expect(() => normalizePhenotypeExtractInput({ text: "x".repeat(21) }, config)).toThrow(
      "20 characters",
    );
    expect(() => normalizePhenotypeExtractInput({ text: 123 }, config)).toThrow();
    expect(() =>
      normalizePhenotypeExtractInput({ text: "seizures", uploadedFile: "nope" }, config),
    ).toThrow("Unrecognized key");
  });
});
