import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { attachLiteratureEvidence } from "@/lib/literature/repository";
import type { PubMedArticle } from "@/lib/literature/types";

const article: PubMedArticle = {
  pmid: "88888888",
  doi: null,
  title: "Gene-only evidence fixture",
  abstract: null,
  journal: null,
  publicationYear: null,
  authors: [],
  url: "https://pubmed.ncbi.nlm.nih.gov/88888888/",
  sourceName: "PubMed",
  fetchedAt: "2026-01-01T00:00:00.000Z",
};

afterEach(async () => {
  await prisma.literatureRecord.deleteMany({ where: { pmid: article.pmid } });
});

describe("literature evidence storage", () => {
  it("can store gene-only evidence without a phenotype term", async () => {
    const gene = await prisma.gene.findUniqueOrThrow({ where: { symbol: "SCN2A" } });

    await attachLiteratureEvidence({
      prisma,
      articles: [article],
      geneId: gene.id,
      evidenceType: "PUBMED_GENE_ONLY",
      sourceQuery: '"SCN2A"[Title/Abstract]',
    });

    const record = await prisma.literatureRecord.findUniqueOrThrow({
      where: { pmid: article.pmid },
      include: { evidence: true },
    });

    expect(record.evidence[0]).toMatchObject({
      geneId: gene.id,
      phenotypeTermId: null,
      sourceQuery: '"SCN2A"[Title/Abstract]',
    });
  });
});
