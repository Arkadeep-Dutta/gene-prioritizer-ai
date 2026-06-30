import type { PrismaClient } from "@prisma/client";

import { searchTerms } from "@/lib/hpo/search";

import type { PhenotypeExtractionConfig } from "./config";
import { getPhenotypeExtractionConfig } from "./config";
import { normalizeForMatching } from "./text";
import type { HpoMappedPhenotype, PhenotypeMappingMethod, RawPhenotypeMention } from "./types";

function mappingMethodFor(
  mention: RawPhenotypeMention,
  result: { label: string; synonyms: string[] },
): PhenotypeMappingMethod {
  if (mention.source === "llm") return "llm_candidate_local_verified";
  const phrase = normalizeForMatching(mention.phrase);
  if (normalizeForMatching(result.label) === phrase) return "local_label";
  if (result.synonyms.some((synonym) => normalizeForMatching(synonym) === phrase)) {
    return "local_synonym";
  }
  return "local_label";
}

export async function mapMentionsToHpo(
  prisma: PrismaClient,
  mentions: RawPhenotypeMention[],
  config: PhenotypeExtractionConfig = getPhenotypeExtractionConfig(),
): Promise<HpoMappedPhenotype[]> {
  const mapped: HpoMappedPhenotype[] = [];

  for (const mention of mentions) {
    const query = mention.proposedHpoId ?? mention.phrase;
    const results = await searchTerms(prisma, query, { limit: config.searchLimitPerPhrase });
    const best = results[0];

    if (!best) {
      mapped.push({
        hpoId: null,
        label: null,
        status: "UNMAPPED",
        confidence: Number(Math.max(0.1, mention.confidence * 0.5).toFixed(2)),
        sourceText: mention.sourceText,
        span: mention.span,
        mappingMethod: "unmapped",
        alternatives: [],
        warnings: [...mention.warnings, "No local HPO term matched this phrase."],
      });
      continue;
    }

    const mappingMethod = mappingMethodFor(mention, best);
    const confidence = Number(
      Math.min(0.99, mention.confidence * Math.max(0.6, best.score / 100)).toFixed(2),
    );
    mapped.push({
      hpoId: best.hpoId,
      label: best.label,
      status: mention.status,
      confidence,
      sourceText: mention.sourceText,
      span: mention.span,
      mappingMethod,
      isObsolete: best.isObsolete,
      definition: best.definition,
      alternatives: results.slice(1, 4).map((alternative) => ({
        hpoId: alternative.hpoId,
        label: alternative.label,
        confidence: Number(
          Math.min(0.95, mention.confidence * Math.max(0.5, alternative.score / 100)).toFixed(2),
        ),
        mappingMethod: mappingMethodFor(mention, alternative),
      })),
      warnings: [
        ...mention.warnings,
        ...(best.isObsolete ? ["Mapped HPO term is obsolete and requires review."] : []),
      ],
    });
  }

  const byStatusAndHpo = new Map<string, HpoMappedPhenotype>();
  for (const term of mapped) {
    const key = `${term.status}:${term.hpoId ?? term.sourceText}`;
    const existing = byStatusAndHpo.get(key);
    if (!existing || term.confidence > existing.confidence) byStatusAndHpo.set(key, term);
  }

  return Array.from(byStatusAndHpo.values()).sort(
    (left, right) =>
      right.confidence - left.confidence ||
      (left.span?.start ?? 0) - (right.span?.start ?? 0) ||
      (left.label ?? left.sourceText).localeCompare(right.label ?? right.sourceText),
  );
}
