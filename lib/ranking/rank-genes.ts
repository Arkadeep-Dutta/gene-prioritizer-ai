import type { PrismaClient } from "@prisma/client";

import { generateGeneLinkouts } from "@/lib/genes/linkouts";
import { getLicensedGeneCardsAnnotationsForGene } from "@/lib/genecards/repository";
import { getDataSourceVersions } from "@/lib/hpo/repository";
import { getLiteratureConfig } from "@/lib/literature/config";
import { searchLiterature } from "@/lib/literature/search";
import type { LiteratureEvidenceForGene } from "@/lib/literature/types";

import type { RankingConfig } from "./config";
import { getRankingConfig } from "./config";
import { explainRankedGene } from "./explain";
import { createRankingInputHash } from "./input-hash";
import { buildAncestorLookup, getRelevantHpoIds, matchGenePhenotypes } from "./match-phenotypes";
import { persistRankingResults } from "./persistence";
import { calculateGeneScore, scoreLabel } from "./scoring";
import type {
  GenePhenotypeForRanking,
  NormalizedCandidateGene,
  NormalizedRankingInput,
  PublicCandidateGene,
  PublicRankedGene,
  RankedGene,
  RankingResponseData,
} from "./types";

export const RANKING_DISCLAIMER =
  "This is not a diagnosis. Results are deterministic research/decision-support prioritization scores and require review by qualified genetics professionals.";

function toAssociationForRanking(association: {
  gene: {
    id: string;
    symbol: string;
    name: string | null;
    hgncId: string | null;
    entrezId: string | null;
    ncbiGeneId: string | null;
    ensemblId: string | null;
    validationStatus: string;
    isValidated: boolean;
  };
  phenotypeTerm: { hpoId: string; label: string; isObsolete: boolean };
  evidenceSource: string | null;
  evidenceCode: string | null;
  diseaseId: string | null;
  diseaseName: string | null;
  frequency: string | null;
  onset: string | null;
  reference: string | null;
}): GenePhenotypeForRanking {
  return {
    geneId: association.gene.id,
    symbol: association.gene.symbol,
    name: association.gene.name,
    hgncId: association.gene.hgncId,
    entrezId: association.gene.entrezId,
    ncbiGeneId: association.gene.ncbiGeneId,
    ensemblId: association.gene.ensemblId,
    validationStatus: association.gene
      .validationStatus as GenePhenotypeForRanking["validationStatus"],
    isValidated: association.gene.isValidated,
    phenotype: {
      hpoId: association.phenotypeTerm.hpoId,
      label: association.phenotypeTerm.label,
      isObsolete: association.phenotypeTerm.isObsolete,
    },
    evidence: {
      evidenceSource: association.evidenceSource,
      evidenceCode: association.evidenceCode,
      diseaseId: association.diseaseId,
      diseaseName: association.diseaseName,
      frequency: association.frequency,
      onset: association.onset,
      reference: association.reference,
    },
  };
}

function candidateKey(candidate: NormalizedCandidateGene): string | null {
  return candidate.symbol ?? candidate.normalizedInput;
}

function toPublicCandidate(candidate: NormalizedCandidateGene): PublicCandidateGene {
  return {
    input: candidate.input,
    normalizedInput: candidate.normalizedInput,
    symbol: candidate.symbol,
    name: candidate.name,
    hgncId: candidate.hgncId,
    entrezId: candidate.entrezId,
    ncbiGeneId: candidate.ncbiGeneId,
    ensemblId: candidate.ensemblId,
    validationStatus: candidate.validationStatus,
    isValidated: candidate.isValidated,
    links: candidate.links,
    warnings: candidate.warnings,
  };
}

function toPublicRankedGene(result: RankedGene): PublicRankedGene {
  return {
    rank: result.rank,
    gene: result.gene,
    score: result.score,
    scoreLabel: result.scoreLabel,
    scoreBreakdown: result.scoreBreakdown,
    matchedPhenotypes: result.matchedPhenotypes,
    warnings: result.warnings,
    explanation: result.explanation,
    isCandidateGene: result.isCandidateGene,
    literatureEvidence: result.literatureEvidence,
  };
}

function calculateLiteratureBoost(evidence: LiteratureEvidenceForGene, maxBoost: number): number {
  const phenotypeSpecificPmids = new Set(
    evidence.queries
      .filter((query) => query.queryType === "gene_phenotype")
      .flatMap((query) => query.pmids),
  );
  const geneOnlyPmids = new Set(
    evidence.queries
      .filter((query) => query.queryType === "gene_only")
      .flatMap((query) => query.pmids),
  );

  let boost = 0;
  if (phenotypeSpecificPmids.size >= 3) boost = maxBoost;
  else if (phenotypeSpecificPmids.size >= 1) boost = Math.min(maxBoost, 3);
  else if (geneOnlyPmids.size >= 3) boost = Math.min(maxBoost, 2);
  else if (geneOnlyPmids.size >= 1) boost = Math.min(maxBoost, 1);

  return Math.max(0, Math.min(maxBoost, boost));
}

async function enrichRankedGenesWithLiterature(
  prisma: PrismaClient,
  ranked: RankedGene[],
  input: NormalizedRankingInput,
): Promise<{ ranked: RankedGene[]; warnings: string[] }> {
  if (!input.includeLiterature) return { ranked, warnings: [] };

  const literatureConfig = getLiteratureConfig();
  const warnings = [
    "Literature support is based on PubMed query matches and does not prove causality.",
    "Absence of PubMed results does not exclude a gene.",
  ];
  const genesToEnrich = ranked
    .filter((result) => result.gene.validationStatus !== "INVALID")
    .slice(0, literatureConfig.rankingEnrichedGeneLimit);

  const enrichedBySymbol = new Map<string, LiteratureEvidenceForGene>();

  for (const result of genesToEnrich) {
    try {
      const literature = await searchLiterature({
        prisma,
        geneSymbols: [result.gene.symbol],
        hpoTerms: input.hpoTerms.map((term) => term.hpoId),
        retmax: input.literatureRetmax,
        includeAbstracts: false,
        summarize: input.literatureSummaries,
        options: { config: literatureConfig, includeGeneOnlyFallback: true, storeEvidence: true },
      });
      const evidence: LiteratureEvidenceForGene = {
        geneSymbol: result.gene.symbol,
        literatureBoost: 0,
        records: literature.records,
        queries: literature.queries,
        warnings: literature.warnings,
      };
      evidence.literatureBoost = calculateLiteratureBoost(
        evidence,
        literatureConfig.rankingBoostMax,
      );
      if (literature.warnings.length > 0) warnings.push(...literature.warnings);
      enrichedBySymbol.set(result.gene.symbol, evidence);
    } catch {
      warnings.push(
        `PubMed literature enrichment failed for ${result.gene.symbol}; ranking returned without citation enrichment for that gene.`,
      );
    }
  }

  const enriched = ranked.map((result) => {
    const evidence = enrichedBySymbol.get(result.gene.symbol);
    if (!evidence) return result;

    const literatureBoost = evidence.literatureBoost;
    const score = Math.min(100, Number((result.score + literatureBoost).toFixed(1)));
    const updated: Omit<RankedGene, "explanation"> = {
      ...result,
      score,
      scoreLabel: scoreLabel(score),
      scoreBreakdown: { ...result.scoreBreakdown, literatureBoost },
      warnings: [...result.warnings, ...evidence.warnings],
      literatureEvidence: evidence,
    };
    return { ...updated, explanation: explainRankedGene(updated) };
  });

  return {
    ranked: enriched
      .sort(
        (left, right) =>
          right.score - left.score ||
          Number(right.isCandidateGene) - Number(left.isCandidateGene) ||
          left.gene.symbol.localeCompare(right.gene.symbol),
      )
      .map((result, index) => ({ ...result, rank: index + 1 })),
    warnings: Array.from(new Set(warnings)),
  };
}

async function enrichRankedGenesWithLicensedGeneCards(
  prisma: PrismaClient,
  ranked: RankedGene[],
): Promise<RankedGene[]> {
  const enriched: RankedGene[] = [];
  for (const result of ranked) {
    const annotations = await getLicensedGeneCardsAnnotationsForGene(prisma, result.gene.symbol, 3);
    if (annotations.length === 0) {
      enriched.push(result);
      continue;
    }
    enriched.push({
      ...result,
      gene: {
        ...result.gene,
        licensedGeneCardsAnnotations: annotations,
      },
    });
  }
  return enriched;
}

function toCandidateOnlyResult(candidate: NormalizedCandidateGene, rank: number): RankedGene {
  const base: Omit<RankedGene, "explanation"> = {
    rank,
    gene: {
      symbol: candidate.symbol ?? candidate.input,
      name: candidate.name,
      validationStatus: candidate.validationStatus,
      hgncId: candidate.hgncId,
      links: candidate.links,
    },
    score: 0,
    scoreLabel: scoreLabel(0),
    scoreBreakdown: {
      exactHpoMatch: 0,
      ancestorHpoMatch: 0,
      specificityWeight: 0,
      evidenceWeight: 0,
      candidateBoost: 0,
      literatureBoost: 0,
      penalties: candidate.validationStatus === "INVALID" ? -5 : -10,
    },
    matchedPhenotypes: [],
    warnings: [...candidate.warnings, "No local HPO association matched the input terms."],
    isCandidateGene: true,
    geneId: candidate.geneId,
  };
  return { ...base, explanation: explainRankedGene(base) };
}

export async function rankGenes(
  prisma: PrismaClient,
  input: NormalizedRankingInput,
  config: RankingConfig = getRankingConfig(),
): Promise<RankingResponseData> {
  const inputHash = createRankingInputHash(input);
  const candidateSymbols = new Set(
    input.candidateGenes.map(candidateKey).filter((symbol): symbol is string => Boolean(symbol)),
  );
  const candidateGeneIds = input.candidateGenes
    .map((candidate) => candidate.geneId)
    .filter((geneId): geneId is string => Boolean(geneId));
  const ancestorLookup = await buildAncestorLookup(prisma, input.hpoTerms, config.ancestorMaxDepth);
  const relevantHpoIds = getRelevantHpoIds(input.hpoTerms, ancestorLookup);

  const where =
    input.rankingMode === "CANDIDATE_ONLY"
      ? {
          geneId: { in: candidateGeneIds.length ? candidateGeneIds : ["__none__"] },
          phenotypeTerm: { hpoId: { in: relevantHpoIds } },
        }
      : { phenotypeTerm: { hpoId: { in: relevantHpoIds } } };

  const associations = (
    await prisma.genePhenotypeAssociation.findMany({
      where,
      include: {
        gene: true,
        phenotypeTerm: { select: { hpoId: true, label: true, isObsolete: true } },
      },
      orderBy: [{ gene: { symbol: "asc" } }, { phenotypeTerm: { hpoId: "asc" } }],
    })
  ).map(toAssociationForRanking);

  const termRows = await prisma.phenotypeTerm.findMany({
    where: { hpoId: { in: input.hpoTerms.map((term) => term.hpoId) } },
    select: { hpoId: true, _count: { select: { geneAssociations: true } } },
  });
  const inputTermAssociationCounts = new Map(
    termRows.map((term) => [term.hpoId, term._count.geneAssociations]),
  );
  const obsoleteInputHpoIds = new Set(
    input.hpoTerms.filter((term) => term.isObsolete).map((term) => term.hpoId),
  );
  const byGene = new Map<string, GenePhenotypeForRanking[]>();

  for (const association of associations) {
    const list = byGene.get(association.symbol) ?? [];
    list.push(association);
    byGene.set(association.symbol, list);
  }

  const results: RankedGene[] = [];
  for (const [symbol, geneAssociations] of byGene.entries()) {
    const first = geneAssociations[0];
    const isCandidateGene = candidateSymbols.has(symbol);
    const matches = matchGenePhenotypes(input.hpoTerms, geneAssociations, ancestorLookup);
    const { score, scoreBreakdown } = calculateGeneScore({
      matches,
      inputTermAssociationCounts,
      rankingMode: input.rankingMode,
      isCandidateGene,
      isValidatedGene: first.isValidated,
      obsoleteInputHpoIds,
      hasNoCandidateAssociation: isCandidateGene && matches.length === 0,
    });
    const warnings = first.isValidated
      ? []
      : ["This gene is not validated in the local HGNC cache."];
    const base: Omit<RankedGene, "explanation"> = {
      rank: 0,
      gene: {
        symbol,
        name: first.name,
        validationStatus: first.validationStatus,
        hgncId: first.hgncId,
        links: generateGeneLinkouts({
          symbol,
          hgncId: first.hgncId,
          entrezId: first.entrezId,
          ncbiGeneId: first.ncbiGeneId,
          ensemblId: first.ensemblId,
        }),
      },
      score,
      scoreLabel: scoreLabel(score),
      scoreBreakdown,
      matchedPhenotypes: matches,
      warnings,
      isCandidateGene,
      geneId: first.geneId,
    };
    results.push({ ...base, explanation: explainRankedGene(base) });
  }

  if (input.rankingMode === "CANDIDATE_ONLY" || input.rankingMode === "CANDIDATE_BOOSTED") {
    for (const candidate of input.candidateGenes) {
      const key = candidateKey(candidate);
      if (!key || results.some((result) => result.gene.symbol === key)) continue;
      results.push(toCandidateOnlyResult(candidate, 0));
    }
  }

  let ranked = results
    .sort(
      (left, right) =>
        right.score - left.score ||
        Number(right.isCandidateGene) - Number(left.isCandidateGene) ||
        left.gene.symbol.localeCompare(right.gene.symbol),
    )
    .slice(0, input.limit)
    .map((result, index) => ({ ...result, rank: index + 1 }));

  const literatureEnrichment = await enrichRankedGenesWithLiterature(prisma, ranked, input);
  ranked = literatureEnrichment.ranked;
  ranked = await enrichRankedGenesWithLicensedGeneCards(prisma, ranked);

  const warnings = [
    "Scores are deterministic prioritization scores, not diagnostic probabilities.",
    input.includeLiterature
      ? "Literature enrichment was requested; PubMed matches are citation support, not clinical proof."
      : "Literature enrichment is available only when includeLiterature=true.",
    ...literatureEnrichment.warnings,
    ...input.warnings,
  ];
  if (ranked.length === 0) {
    warnings.push("No local gene-phenotype associations matched the submitted HPO terms.");
  }

  const dataVersions = Object.fromEntries(
    (await getDataSourceVersions(prisma)).map((version) => [
      version.sourceName,
      {
        sourceType: version.sourceType,
        version: version.version,
        importedAt: version.importedAt,
      },
    ]),
  );

  const response: RankingResponseData = {
    inputHash,
    algorithmVersion: input.algorithmVersion,
    rankingMode: input.rankingMode,
    confirmedHpoTerms: input.hpoTerms,
    candidateGenes: input.candidateGenes.map(toPublicCandidate),
    results: ranked.map(toPublicRankedGene),
    dataVersions,
    warnings: Array.from(new Set(warnings)),
    literatureWarnings: literatureEnrichment.warnings,
    disclaimer: RANKING_DISCLAIMER,
  };

  if (input.storeResults) {
    response.caseId = await persistRankingResults(prisma, input, inputHash, ranked);
  }

  return response;
}
