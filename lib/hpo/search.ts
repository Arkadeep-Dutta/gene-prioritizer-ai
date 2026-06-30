import type { PrismaClient } from "@prisma/client";

import { DEFAULT_HPO_SEARCH_LIMIT, MAX_HPO_QUERY_LENGTH, MAX_HPO_SEARCH_LIMIT } from "./constants";
import { HpoValidationError } from "./errors";
import { normalizeSearchText } from "./normalize";
import { isExactHpoLookup, toHpoSearchResult } from "./repository";
import type { HpoSearchResult } from "./types";
import { normalizeHpoId } from "./validate";

function scoreResult(result: HpoSearchResult, query: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerLabel = result.label.toLowerCase();
  const lowerSynonyms = result.synonyms.map((synonym) => synonym.toLowerCase());

  if (result.hpoId === query) return 100;
  if (lowerLabel === lowerQuery) return 90;
  if (lowerLabel.startsWith(lowerQuery)) return 80;
  if (lowerSynonyms.includes(lowerQuery)) return 75;
  if (lowerLabel.includes(lowerQuery)) return 60;
  if (lowerSynonyms.some((synonym) => synonym.includes(lowerQuery))) return 50;
  return 10;
}

function buildCaseVariants(query: string): string[] {
  const lower = query.toLowerCase();
  const upper = query.toUpperCase();
  const firstLetterUpper = query.charAt(0).toUpperCase() + query.slice(1);
  return Array.from(new Set([query, lower, upper, firstLetterUpper])).filter(Boolean);
}

export function normalizeSearchLimit(limit: string | number | undefined): number {
  const parsed = typeof limit === "number" ? limit : Number.parseInt(limit ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_HPO_SEARCH_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_HPO_SEARCH_LIMIT);
}

export function normalizeSearchQuery(query: string | null): string {
  const normalized = normalizeSearchText(query ?? "");
  if (!normalized) throw new HpoValidationError("Search query parameter q is required.");
  if (normalized.length > MAX_HPO_QUERY_LENGTH) {
    throw new HpoValidationError(
      `Search query must be ${MAX_HPO_QUERY_LENGTH} characters or fewer.`,
    );
  }
  return normalized;
}

export async function searchTerms(
  prisma: PrismaClient,
  queryInput: string,
  options: { limit?: number } = {},
): Promise<HpoSearchResult[]> {
  const query = normalizeSearchQuery(queryInput);
  const limit = normalizeSearchLimit(options.limit);
  const exactHpoId = normalizeHpoId(query);

  if (isExactHpoLookup(query) && exactHpoId) {
    const exact = await prisma.phenotypeTerm.findUnique({
      where: { hpoId: exactHpoId },
      include: { synonyms: { orderBy: { synonym: "asc" } } },
    });
    return exact ? [{ ...toHpoSearchResult(exact), score: 100 }] : [];
  }

  const candidateTake = Math.min(limit * 5, 250);
  const queryVariants = buildCaseVariants(query);
  const [labelMatches, synonymMatches] = await Promise.all([
    prisma.phenotypeTerm.findMany({
      where: { OR: queryVariants.map((variant) => ({ label: { contains: variant } })) },
      include: { synonyms: { orderBy: { synonym: "asc" } } },
      take: candidateTake,
      orderBy: { label: "asc" },
    }),
    prisma.phenotypeTerm.findMany({
      where: {
        OR: queryVariants.map((variant) => ({
          synonyms: { some: { synonym: { contains: variant } } },
        })),
      },
      include: { synonyms: { orderBy: { synonym: "asc" } } },
      take: candidateTake,
      orderBy: { label: "asc" },
    }),
  ]);

  const byHpoId = new Map<string, HpoSearchResult>();
  for (const term of [...labelMatches, ...synonymMatches]) {
    const result = toHpoSearchResult(term);
    result.score = scoreResult(result, query);
    byHpoId.set(result.hpoId, result);
  }

  return Array.from(byHpoId.values())
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
    .slice(0, limit);
}
