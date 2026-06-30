import type { PrismaClient } from "@prisma/client";

import type { PubMedArticle } from "./types";

export async function upsertLiteratureRecord(prisma: PrismaClient, article: PubMedArticle) {
  return prisma.literatureRecord.upsert({
    where: { pmid: article.pmid },
    update: {
      doi: article.doi,
      title: article.title,
      abstract: article.abstract,
      journal: article.journal,
      publicationYear: article.publicationYear,
      authorsJson: article.authors,
      url: article.url,
      sourceName: article.sourceName,
      fetchedAt: new Date(article.fetchedAt),
    },
    create: {
      pmid: article.pmid,
      doi: article.doi,
      title: article.title,
      abstract: article.abstract,
      journal: article.journal,
      publicationYear: article.publicationYear,
      authorsJson: article.authors,
      url: article.url,
      sourceName: article.sourceName,
      fetchedAt: new Date(article.fetchedAt),
    },
  });
}

export async function upsertLiteratureRecords(
  prisma: PrismaClient,
  articles: PubMedArticle[],
): Promise<void> {
  for (const article of articles) {
    await upsertLiteratureRecord(prisma, article);
  }
}

export async function getCachedLiteratureRecords(
  prisma: PrismaClient,
  pmids: string[],
  ttlSeconds: number,
): Promise<PubMedArticle[]> {
  if (pmids.length === 0) return [];
  const threshold = new Date(Date.now() - ttlSeconds * 1000);
  const rows = await prisma.literatureRecord.findMany({
    where: { pmid: { in: pmids }, fetchedAt: { gte: threshold } },
  });
  return rows
    .filter((row) => row.pmid)
    .map((row) => ({
      pmid: row.pmid!,
      doi: row.doi,
      title: row.title,
      abstract: row.abstract,
      journal: row.journal,
      publicationYear: row.publicationYear,
      authors: Array.isArray(row.authorsJson) ? row.authorsJson.map(String) : [],
      url: row.url ?? `https://pubmed.ncbi.nlm.nih.gov/${row.pmid}/`,
      sourceName: "PubMed",
      fetchedAt: (row.fetchedAt ?? row.updatedAt).toISOString(),
    }));
}

export async function attachLiteratureEvidence(input: {
  prisma: PrismaClient;
  articles: PubMedArticle[];
  geneId?: string | null;
  phenotypeTermIds?: string[];
  rankingResultId?: string | null;
  evidenceType: string;
  sourceQuery: string;
  summary?: string | null;
}): Promise<void> {
  for (const article of input.articles) {
    const record = await upsertLiteratureRecord(input.prisma, article);
    const phenotypeIds = input.phenotypeTermIds?.length ? input.phenotypeTermIds : [undefined];
    for (const phenotypeTermId of phenotypeIds) {
      const existing = await input.prisma.literatureEvidence.findFirst({
        where: {
          literatureRecordId: record.id,
          geneId: input.geneId ?? null,
          phenotypeTermId: phenotypeTermId ?? null,
          rankingResultId: input.rankingResultId ?? null,
          sourceQuery: input.sourceQuery,
        },
        select: { id: true },
      });
      if (!existing) {
        await input.prisma.literatureEvidence.create({
          data: {
            literatureRecordId: record.id,
            geneId: input.geneId ?? null,
            phenotypeTermId: phenotypeTermId ?? null,
            rankingResultId: input.rankingResultId ?? null,
            evidenceType: input.evidenceType,
            summary: input.summary ?? null,
            sourceQuery: input.sourceQuery,
          },
        });
      }
    }
  }
}
