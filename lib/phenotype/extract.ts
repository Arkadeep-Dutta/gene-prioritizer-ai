import type { PrismaClient } from "@prisma/client";

import { getLlmConfig } from "@/lib/llm/config";
import { LlmExtractionError } from "@/lib/llm/errors";
import {
  getConfiguredLlmProvider,
  runLlmPhenotypeExtraction,
  shouldUseExternalLlm,
} from "@/lib/llm/provider";
import type { LlmConfig, LlmPhenotypeProvider } from "@/lib/llm/types";

import type { PhenotypeExtractionConfig } from "./config";
import { getPhenotypeExtractionConfig } from "./config";
import { deterministicPhenotypeMatch } from "./deterministic-matcher";
import { normalizePhenotypeExtractInput } from "./input";
import { mapMentionsToHpo } from "./map-to-hpo";
import { extractPhenotypeMetadata } from "./metadata";
import type {
  HpoMappedPhenotype,
  PhenotypeExtractionMethod,
  PhenotypeExtractionResult,
  PhenotypeStatus,
  RawPhenotypeMention,
} from "./types";

export const PHENOTYPE_EXTRACTION_DISCLAIMER =
  "This is not a diagnosis. Extracted HPO terms are suggestions and require review by qualified genetics professionals before ranking or interpretation.";

function groupByStatus(terms: HpoMappedPhenotype[], status: PhenotypeStatus): HpoMappedPhenotype[] {
  return terms.filter((term) => term.status === status);
}

function confirmedPresentHpoTerms(terms: HpoMappedPhenotype[]): string[] {
  return Array.from(
    new Set(
      terms
        .filter((term) => term.status === "PRESENT" && term.hpoId)
        .map((term) => term.hpoId as string),
    ),
  );
}

async function extractWithOptionalLlm(input: {
  prisma: PrismaClient;
  text: string;
  useLLM: boolean;
  config: PhenotypeExtractionConfig;
  llmConfig: LlmConfig;
  llmProvider?: LlmPhenotypeProvider;
  maxTerms: number;
}): Promise<{
  mentions: RawPhenotypeMention[];
  method: PhenotypeExtractionMethod;
  warnings: string[];
}> {
  const llmDecision = shouldUseExternalLlm({
    requested: input.useLLM,
    allowExternalLlm: input.config.allowExternalLlm,
    config: input.llmConfig,
  });
  const warnings = [...llmDecision.warnings];

  if (llmDecision.allowed) {
    try {
      const provider = input.llmProvider ?? getConfiguredLlmProvider(input.llmConfig);
      const mentions = await runLlmPhenotypeExtraction({
        text: input.text,
        provider,
        config: input.llmConfig,
      });
      return {
        mentions: mentions.slice(0, input.maxTerms),
        method: "llm",
        warnings,
      };
    } catch (error) {
      const message =
        error instanceof LlmExtractionError
          ? error.message
          : "LLM extraction failed; deterministic fallback used.";
      warnings.push(message);
      const mentions = await deterministicPhenotypeMatch(input.prisma, input.text, {
        maxTerms: input.maxTerms,
      });
      return { mentions, method: "llm_with_deterministic_fallback", warnings };
    }
  }

  const mentions = await deterministicPhenotypeMatch(input.prisma, input.text, {
    maxTerms: input.maxTerms,
  });
  return { mentions, method: "deterministic", warnings };
}

export async function extractPhenotypes(
  prisma: PrismaClient,
  rawBody: unknown,
  options: {
    config?: PhenotypeExtractionConfig;
    llmConfig?: LlmConfig;
    llmProvider?: LlmPhenotypeProvider;
  } = {},
): Promise<PhenotypeExtractionResult> {
  const config = options.config ?? getPhenotypeExtractionConfig();
  const input = normalizePhenotypeExtractInput(rawBody, config);
  const llmConfig = options.llmConfig ?? getLlmConfig();
  const metadata = extractPhenotypeMetadata(input.text);
  const extraction = await extractWithOptionalLlm({
    prisma,
    text: input.text,
    useLLM: input.useLLM,
    config,
    llmConfig,
    llmProvider: options.llmProvider,
    maxTerms: input.maxTerms,
  });

  const mapped = await mapMentionsToHpo(prisma, extraction.mentions, config);
  const present = groupByStatus(mapped, "PRESENT");
  const negated = input.includeNegated ? groupByStatus(mapped, "NEGATED") : [];
  const uncertain = input.includeUncertain ? groupByStatus(mapped, "UNCERTAIN") : [];
  const familyHistory = input.includeFamilyHistory ? groupByStatus(mapped, "FAMILY_HISTORY") : [];
  const unmapped = groupByStatus(mapped, "UNMAPPED");

  const warnings = [
    "Review and confirm extracted HPO terms before ranking.",
    "This is not a diagnosis.",
    ...extraction.warnings,
    ...metadata.warnings,
  ];
  if (mapped.length === 0) {
    warnings.push("No local HPO phenotype terms were found in the submitted text.");
  }

  return {
    extractionId: null,
    method: extraction.method,
    requiresConfirmation: config.requireConfirmation,
    terms: present,
    negatedTerms: negated,
    uncertainTerms: uncertain,
    familyHistoryTerms: familyHistory,
    unmappedTerms: unmapped,
    metadata,
    confirmedHpoTermsForRanking: confirmedPresentHpoTerms(present),
    warnings,
    disclaimer: PHENOTYPE_EXTRACTION_DISCLAIMER,
  };
}
