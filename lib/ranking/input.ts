import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { generateGeneLinkouts } from "@/lib/genes/linkouts";
import { parseGeneSymbolInput } from "@/lib/genes/normalize";
import { getGeneDetailBySymbolOrAlias } from "@/lib/genes/repository";
import { assertValidHpoId } from "@/lib/hpo/validate";
import { getLiteratureConfig } from "@/lib/literature/config";

import type { RankingConfig } from "./config";
import { getRankingConfig } from "./config";
import { RankingError } from "./errors";
import { RANKING_MODES } from "./types";
import type {
  ConfirmedHpoTerm,
  NormalizedCandidateGene,
  NormalizedRankingInput,
  RankingMode,
  SafeRankingMetadata,
} from "./types";

const metadataValueSchema = z.union([z.string().max(200), z.number(), z.boolean(), z.null()]);

export const prioritizeRequestSchema = z
  .object({
    hpoTerms: z.array(z.string().min(1)),
    candidateGenes: z.array(z.string().min(1)).optional(),
    rankingMode: z.enum(RANKING_MODES).optional(),
    limit: z.number().int().positive().optional(),
    storeResults: z.boolean().optional(),
    privacyMode: z.boolean().optional(),
    includeLiterature: z.boolean().optional(),
    literatureRetmax: z.number().int().positive().optional(),
    literatureSummaries: z.boolean().optional(),
    metadata: z.record(metadataValueSchema).optional(),
  })
  .strict();

export type PrioritizeRequestBody = z.infer<typeof prioritizeRequestSchema>;

function metadataSize(metadata: SafeRankingMetadata): number {
  return JSON.stringify(metadata).length;
}

async function normalizeHpoTerms(
  prisma: PrismaClient,
  rawTerms: string[],
  config: RankingConfig,
): Promise<ConfirmedHpoTerm[]> {
  if (rawTerms.length === 0) {
    throw new RankingError("At least one confirmed HPO term is required.", "HPO_TERMS_REQUIRED");
  }
  if (rawTerms.length > config.hpoTermLimit) {
    throw new RankingError(
      `Ranking accepts at most ${config.hpoTermLimit} HPO terms per request.`,
      "HPO_TERM_LIMIT_EXCEEDED",
      413,
    );
  }

  const seen = new Set<string>();
  const normalized = rawTerms.map((term) => {
    try {
      return assertValidHpoId(term);
    } catch {
      throw new RankingError(
        `Invalid HPO ID "${term}". Expected HP: followed by exactly 7 digits.`,
        "HPO_ID_INVALID",
      );
    }
  });

  const unique = normalized.filter((hpoId) => {
    if (seen.has(hpoId)) return false;
    seen.add(hpoId);
    return true;
  });

  const terms = await prisma.phenotypeTerm.findMany({
    where: { hpoId: { in: unique } },
    select: { hpoId: true, label: true, isObsolete: true },
  });
  const byId = new Map(terms.map((term) => [term.hpoId, term]));
  const missing = unique.find((hpoId) => !byId.has(hpoId));
  if (missing) {
    throw new RankingError(
      `HPO term ${missing} was not found in the local ontology database.`,
      "HPO_TERM_NOT_FOUND",
      404,
    );
  }

  return unique.map((hpoId) => byId.get(hpoId)!);
}

async function normalizeCandidateGenes(
  prisma: PrismaClient,
  rawCandidates: string[] | undefined,
  config: RankingConfig,
): Promise<NormalizedCandidateGene[]> {
  if (!rawCandidates?.length) return [];
  if (rawCandidates.length > config.candidateGeneLimit) {
    throw new RankingError(
      `Ranking accepts at most ${config.candidateGeneLimit} candidate genes per request.`,
      "CANDIDATE_GENE_LIMIT_EXCEEDED",
      413,
    );
  }

  const parsed = parseGeneSymbolInput(rawCandidates);
  const candidates: NormalizedCandidateGene[] = [];
  const seen = new Set<string>();

  for (const entry of parsed) {
    const key = entry.normalized ?? `invalid:${entry.original}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (!entry.validFormat || !entry.normalized) {
      candidates.push({
        input: entry.original,
        normalizedInput: null,
        symbol: null,
        name: null,
        hgncId: null,
        entrezId: null,
        ncbiGeneId: null,
        ensemblId: null,
        validationStatus: "INVALID",
        isValidated: false,
        geneId: null,
        links: null,
        warnings: [`Invalid candidate gene symbol ignored: ${entry.original}`],
      });
      continue;
    }

    const gene = await getGeneDetailBySymbolOrAlias(prisma, entry.normalized);
    if (!gene) {
      candidates.push({
        input: entry.original,
        normalizedInput: entry.normalized,
        symbol: entry.normalized,
        name: null,
        hgncId: null,
        entrezId: null,
        ncbiGeneId: null,
        ensemblId: null,
        validationStatus: "UNVALIDATED",
        isValidated: false,
        geneId: null,
        links: generateGeneLinkouts({ symbol: entry.normalized }),
        warnings: [
          "No local validated gene record was found; no external validation was performed during ranking.",
        ],
      });
      continue;
    }

    candidates.push({
      input: entry.original,
      normalizedInput: entry.normalized,
      symbol: gene.symbol,
      name: gene.name,
      hgncId: gene.hgncId,
      entrezId: gene.entrezId,
      ncbiGeneId: gene.ncbiGeneId,
      ensemblId: gene.ensemblId,
      validationStatus: gene.validationStatus as NormalizedCandidateGene["validationStatus"],
      isValidated: gene.isValidated,
      geneId: gene.id,
      links: generateGeneLinkouts({
        symbol: gene.symbol,
        hgncId: gene.hgncId,
        entrezId: gene.entrezId,
        ncbiGeneId: gene.ncbiGeneId,
        ensemblId: gene.ensemblId,
      }),
      warnings: gene.isValidated
        ? []
        : ["This candidate gene is not validated in the local cache."],
    });
  }

  return candidates;
}

export async function normalizeRankingInput(
  prisma: PrismaClient,
  rawBody: unknown,
  config: RankingConfig = getRankingConfig(),
): Promise<NormalizedRankingInput> {
  const body = prioritizeRequestSchema.parse(rawBody);
  const metadata = body.metadata ?? {};
  if (metadataSize(metadata) > 2_000) {
    throw new RankingError("Ranking metadata payload is too large.", "METADATA_TOO_LARGE", 413);
  }

  const hpoTerms = await normalizeHpoTerms(prisma, body.hpoTerms, config);
  const candidateGenes = await normalizeCandidateGenes(prisma, body.candidateGenes, config);
  const rankingMode = (body.rankingMode ?? "ALL_GENES") as RankingMode;
  const limit = Math.min(body.limit ?? config.defaultLimit, config.maxLimit);
  const literatureConfig = getLiteratureConfig();
  const literatureRetmax = Math.min(
    body.literatureRetmax ?? literatureConfig.defaultRetmax,
    literatureConfig.maxRetmax,
  );
  const warnings = [
    ...hpoTerms.filter((term) => term.isObsolete).map((term) => `${term.hpoId} is obsolete.`),
    ...candidateGenes.flatMap((candidate) => candidate.warnings),
  ];

  return {
    hpoTerms,
    candidateGenes,
    rankingMode,
    limit,
    storeResults: body.storeResults ?? config.storeResultsDefault,
    privacyMode: body.privacyMode ?? config.privacyModeDefault,
    includeLiterature: body.includeLiterature ?? literatureConfig.attachToRankingDefault,
    literatureRetmax,
    literatureSummaries: body.literatureSummaries ?? false,
    metadata,
    warnings,
    algorithmVersion: config.algorithmVersion,
  };
}
