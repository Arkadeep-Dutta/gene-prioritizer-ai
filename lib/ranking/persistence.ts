import type { Prisma, PrismaClient } from "@prisma/client";

import type { NormalizedRankingInput, RankedGene } from "./types";

export async function persistRankingResults(
  prisma: PrismaClient,
  input: NormalizedRankingInput,
  inputHash: string,
  results: RankedGene[],
): Promise<string> {
  const userCase = await prisma.userCase.upsert({
    where: { inputHash },
    update: {
      hpoTermsJson: input.hpoTerms.map((term) => term.hpoId),
      candidateGenesJson: input.candidateGenes.map((gene) => gene.symbol ?? gene.normalizedInput),
      metadataJson: input.metadata,
      privacyMode: input.privacyMode,
      consentToStoreRawText: false,
      rawTextRedacted: null,
      rawTextStored: false,
    },
    create: {
      inputHash,
      inputType: "HPO_RANKING",
      hpoTermsJson: input.hpoTerms.map((term) => term.hpoId),
      candidateGenesJson: input.candidateGenes.map((gene) => gene.symbol ?? gene.normalizedInput),
      metadataJson: input.metadata,
      privacyMode: input.privacyMode,
      consentToStoreRawText: false,
      rawTextStored: false,
    },
    select: { id: true },
  });

  await prisma.geneRankingResult.deleteMany({
    where: { userCaseId: userCase.id, algorithmVersion: input.algorithmVersion },
  });

  const rows: Prisma.GeneRankingResultCreateManyInput[] = results
    .filter((result) => result.geneId)
    .map((result) => ({
      userCaseId: userCase.id,
      geneId: result.geneId!,
      rank: result.rank,
      score: result.score,
      scoreBreakdown: result.scoreBreakdown,
      matchedPhenotypes: result.matchedPhenotypes,
      evidenceJson: {
        explanation: result.explanation,
        scoreLabel: result.scoreLabel,
        literatureBoostImplemented: input.includeLiterature,
        literatureEvidence: result.literatureEvidence
          ? {
              pmids: result.literatureEvidence.records.map((record) => record.pmid),
              queries: result.literatureEvidence.queries.map((query) => ({
                query: query.query,
                queryType: query.queryType,
                pmids: query.pmids,
              })),
            }
          : null,
      },
      warningsJson: result.warnings,
      rankingMode: input.rankingMode,
      algorithmVersion: input.algorithmVersion,
    }));

  if (rows.length > 0) {
    await prisma.geneRankingResult.createMany({ data: rows });
  }

  return userCase.id;
}
