import type { PrismaClient } from "@prisma/client";

import { prisma as defaultPrisma } from "@/lib/db/prisma";

import { GeneValidationError } from "./errors";
import { resolveHgncSymbol } from "./hgnc-client";
import { generateGeneLinkouts } from "./linkouts";
import { MAX_GENE_TEXT_LENGTH, normalizeGeneSymbol, parseGeneSymbolInput } from "./normalize";
import {
  cachedGeneToValidationResult,
  findCachedValidatedGene,
  upsertValidatedGene,
} from "./repository";
import type {
  GeneValidationOptions,
  GeneValidationResult,
  GeneValidationSummary,
  HgncResolver,
} from "./types";

export const DEFAULT_GENE_VALIDATION_BATCH_LIMIT = 200;

function readBatchLimit(environment: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number.parseInt(
    environment.GENE_VALIDATION_BATCH_LIMIT ?? `${DEFAULT_GENE_VALIDATION_BATCH_LIMIT}`,
    10,
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_GENE_VALIDATION_BATCH_LIMIT;
}

function summarize(results: GeneValidationResult[]): GeneValidationSummary {
  return {
    total: results.length,
    validated: results.filter((result) => result.status === "VALIDATED").length,
    aliasResolved: results.filter((result) => result.status === "ALIAS_RESOLVED").length,
    previousSymbolResolved: results.filter((result) => result.status === "PREVIOUS_SYMBOL_RESOLVED")
      .length,
    invalid: results.filter((result) => result.status === "INVALID").length,
    unvalidated: results.filter((result) => result.status === "UNVALIDATED").length,
    unknown: results.filter((result) => result.status === "UNKNOWN").length,
  };
}

function defaultResolver(): HgncResolver {
  return { resolveHgncSymbol };
}

async function validateOneGene(
  prisma: PrismaClient,
  input: string,
  normalizedInput: string,
  resolver: HgncResolver,
  useCache: boolean,
): Promise<GeneValidationResult> {
  if (useCache) {
    const cached = cachedGeneToValidationResult(
      input,
      normalizedInput,
      await findCachedValidatedGene(prisma, normalizedInput),
    );
    if (cached) return cached;
  }

  const live = await resolver.resolveHgncSymbol(normalizedInput);
  const result = { ...live, input, normalizedInput };

  if (result.status === "UNVALIDATED") {
    const cached = cachedGeneToValidationResult(
      input,
      normalizedInput,
      await findCachedValidatedGene(prisma, normalizedInput),
      ["Live HGNC validation was unavailable; returning previously validated local record."],
    );
    if (cached) return cached;
  }

  await upsertValidatedGene(prisma, result);
  return result;
}

export async function validateGeneSymbols(
  input: string[] | string,
  options: GeneValidationOptions & { prisma?: PrismaClient } = {},
): Promise<{ results: GeneValidationResult[]; summary: GeneValidationSummary }> {
  if (typeof input === "string" && input.length > MAX_GENE_TEXT_LENGTH) {
    throw new GeneValidationError("Gene input text is too long.", "GENE_INPUT_TOO_LARGE", 413);
  }

  const parsed = parseGeneSymbolInput(input);
  if (parsed.length === 0) {
    throw new GeneValidationError("At least one gene symbol is required.", "GENE_INPUT_REQUIRED");
  }

  const invalid = parsed.find((entry) => !entry.validFormat || !entry.normalized);
  if (invalid) {
    throw new GeneValidationError(
      `Invalid gene symbol input: ${invalid.original}`,
      "GENE_SYMBOL_INVALID",
      400,
    );
  }

  const batchLimit = readBatchLimit();
  if (parsed.length > batchLimit) {
    throw new GeneValidationError(
      `Gene validation is limited to ${batchLimit} symbols per request.`,
      "GENE_BATCH_LIMIT_EXCEEDED",
      413,
    );
  }

  const prismaClient = options.prisma ?? defaultPrisma;
  const resolver = options.hgncClient ?? defaultResolver();
  const useCache = options.useCache ?? true;
  const results: GeneValidationResult[] = [];

  for (const entry of parsed) {
    const normalized = normalizeGeneSymbol(entry.original);
    if (!normalized) {
      throw new GeneValidationError(
        `Invalid gene symbol input: ${entry.original}`,
        "GENE_SYMBOL_INVALID",
        400,
      );
    }

    const result = await validateOneGene(
      prismaClient,
      entry.original,
      normalized,
      resolver,
      useCache,
    );

    if (!result.links && result.canonicalSymbol) {
      result.links = generateGeneLinkouts({ symbol: result.canonicalSymbol });
    }
    results.push(result);
  }

  return { results, summary: summarize(results) };
}
