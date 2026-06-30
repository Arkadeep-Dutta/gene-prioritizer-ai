import { z } from "zod";

import type { PhenotypeExtractionConfig } from "./config";
import { getPhenotypeExtractionConfig } from "./config";
import { PhenotypeExtractionError } from "./errors";

export const phenotypeExtractRequestSchema = z
  .object({
    text: z.string(),
    useLLM: z.boolean().optional(),
    includeNegated: z.boolean().optional(),
    includeUncertain: z.boolean().optional(),
    includeFamilyHistory: z.boolean().optional(),
    maxTerms: z.number().int().positive().optional(),
  })
  .strict();

export type PhenotypeExtractRequest = z.infer<typeof phenotypeExtractRequestSchema>;

export type NormalizedPhenotypeExtractInput = {
  text: string;
  useLLM: boolean;
  includeNegated: boolean;
  includeUncertain: boolean;
  includeFamilyHistory: boolean;
  maxTerms: number;
};

export function normalizePhenotypeExtractInput(
  rawBody: unknown,
  config: PhenotypeExtractionConfig = getPhenotypeExtractionConfig(),
): NormalizedPhenotypeExtractInput {
  const body = phenotypeExtractRequestSchema.parse(rawBody);
  const text = body.text.trim();
  if (!text) {
    throw new PhenotypeExtractionError(
      "Phenotype extraction text is required.",
      "PHENOTYPE_TEXT_REQUIRED",
    );
  }
  if (text.length > config.textMaxChars) {
    throw new PhenotypeExtractionError(
      `Phenotype extraction text must be ${config.textMaxChars} characters or fewer.`,
      "PHENOTYPE_TEXT_TOO_LONG",
      413,
    );
  }

  return {
    text,
    useLLM: body.useLLM ?? false,
    includeNegated: body.includeNegated ?? true,
    includeUncertain: body.includeUncertain ?? true,
    includeFamilyHistory: body.includeFamilyHistory ?? true,
    maxTerms: Math.min(body.maxTerms ?? config.maxExtractedTerms, config.maxExtractedTerms),
  };
}
