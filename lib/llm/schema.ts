import { z } from "zod";

import type { RawPhenotypeMention } from "@/lib/phenotype/types";

const llmMentionSchema = z.object({
  phrase: z.string().min(1).max(200),
  status: z.enum(["PRESENT", "NEGATED", "UNCERTAIN", "FAMILY_HISTORY", "UNMAPPED"]),
  confidence: z.number().min(0).max(1).default(0.5),
  sourceText: z.string().min(1).max(300),
  proposedHpoId: z
    .string()
    .regex(/^HP:\d{7}$/)
    .nullable()
    .optional(),
  span: z
    .object({
      start: z.number().int().nonnegative(),
      end: z.number().int().nonnegative(),
    })
    .refine((span) => span.end >= span.start, "span end must be after start")
    .optional(),
});

export const llmPhenotypeResponseSchema = z.object({
  mentions: z.array(llmMentionSchema).max(100),
});

export function validateLlmPhenotypeMentions(input: unknown): RawPhenotypeMention[] {
  const parsed = llmPhenotypeResponseSchema.parse(input);
  return parsed.mentions.map((mention) => ({
    phrase: mention.phrase,
    status: mention.status,
    confidence: mention.confidence,
    sourceText: mention.sourceText,
    span: mention.span,
    proposedHpoId: mention.proposedHpoId,
    source: "llm",
    warnings: [],
  }));
}
