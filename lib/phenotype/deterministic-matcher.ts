import type { PrismaClient } from "@prisma/client";

import { hasFamilyHistoryCue } from "./family-history";
import { hasNegationCue } from "./negation";
import { findNormalizedPhraseSpans, normalizeForMatching, splitIntoSentenceSpans } from "./text";
import type { PhenotypeStatus, RawPhenotypeMention } from "./types";
import { hasUncertaintyCue } from "./uncertainty";

const GENERIC_TERMS = new Set([
  "all",
  "abnormality",
  "phenotype",
  "disease",
  "history",
  "normal",
  "patient",
]);

type SearchableTerm = {
  hpoId: string;
  label: string;
  isObsolete: boolean;
  synonyms: { synonym: string }[];
};

function isSearchablePhrase(phrase: string): boolean {
  const normalized = normalizeForMatching(phrase);
  if (normalized.length < 4) return false;
  if (GENERIC_TERMS.has(normalized)) return false;
  return normalized.split(" ").some((word) => word.length > 3);
}

function classifyMention(
  sentence: string,
  localSpan: { start: number; end: number },
): {
  status: PhenotypeStatus;
  warnings: string[];
} {
  const family = hasFamilyHistoryCue(sentence, localSpan);
  const negated = hasNegationCue(sentence, localSpan);
  const uncertain = hasUncertaintyCue(sentence, localSpan);

  if (family && negated) {
    return {
      status: "NEGATED",
      warnings: ["Negated family-history mention; excluded from default ranking."],
    };
  }
  if (family) {
    return {
      status: "FAMILY_HISTORY",
      warnings: ["Family-history-only phenotype; not treated as patient phenotype by default."],
    };
  }
  if (negated) {
    return {
      status: "NEGATED",
      warnings: ["Negated phenotype; excluded from default ranking."],
    };
  }
  if (uncertain) {
    return {
      status: "UNCERTAIN",
      warnings: ["Uncertain phenotype; excluded from default ranking until confirmed."],
    };
  }
  return { status: "PRESENT", warnings: [] };
}

function confidenceForMatch(input: {
  label: string;
  phrase: string;
  matchedBy: "label" | "synonym";
  isObsolete: boolean;
  status: PhenotypeStatus;
}): number {
  let confidence = input.matchedBy === "label" ? 0.9 : 0.86;
  if (normalizeForMatching(input.label) !== normalizeForMatching(input.phrase)) confidence -= 0.05;
  if (input.isObsolete) confidence -= 0.2;
  if (input.status === "UNCERTAIN" || input.status === "FAMILY_HISTORY") confidence -= 0.08;
  if (input.status === "NEGATED") confidence -= 0.04;
  return Number(Math.max(0.2, Math.min(0.99, confidence)).toFixed(2));
}

export async function deterministicPhenotypeMatch(
  prisma: PrismaClient,
  text: string,
  options: { maxTerms?: number } = {},
): Promise<RawPhenotypeMention[]> {
  const terms: SearchableTerm[] = await prisma.phenotypeTerm.findMany({
    select: {
      hpoId: true,
      label: true,
      isObsolete: true,
      synonyms: { select: { synonym: true }, orderBy: { synonym: "asc" } },
    },
    orderBy: { label: "asc" },
  });

  const phrases = terms.flatMap((term) => [
    { term, phrase: term.label, matchedBy: "label" as const },
    ...term.synonyms.map((synonym) => ({
      term,
      phrase: synonym.synonym,
      matchedBy: "synonym" as const,
    })),
  ]);

  const mentions = new Map<string, RawPhenotypeMention>();
  const sentences = splitIntoSentenceSpans(text);

  for (const sentence of sentences) {
    for (const candidate of phrases) {
      if (!isSearchablePhrase(candidate.phrase)) continue;
      const spans = findNormalizedPhraseSpans(sentence.text, candidate.phrase);
      for (const localSpan of spans) {
        const absoluteSpan = {
          start: sentence.start + localSpan.start,
          end: sentence.start + localSpan.end,
        };
        const sourceText = text.slice(absoluteSpan.start, absoluteSpan.end);
        const { status, warnings } = classifyMention(sentence.text, localSpan);
        const confidence = confidenceForMatch({
          label: candidate.term.label,
          phrase: candidate.phrase,
          matchedBy: candidate.matchedBy,
          isObsolete: candidate.term.isObsolete,
          status,
        });
        const key = `${candidate.term.hpoId}:${status}`;
        const existing = mentions.get(key);
        if (!existing || confidence > existing.confidence) {
          mentions.set(key, {
            phrase: candidate.phrase,
            status,
            confidence,
            span: absoluteSpan,
            sourceText,
            source: "deterministic",
            proposedHpoId: candidate.term.hpoId,
            warnings,
          });
        }
      }
    }
  }

  return Array.from(mentions.values())
    .sort(
      (left, right) =>
        right.confidence - left.confidence ||
        (left.span?.start ?? 0) - (right.span?.start ?? 0) ||
        left.phrase.localeCompare(right.phrase),
    )
    .slice(0, options.maxTerms);
}
