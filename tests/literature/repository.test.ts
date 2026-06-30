import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
  attachLiteratureEvidence,
  getCachedLiteratureRecords,
  upsertLiteratureRecord,
  upsertLiteratureRecords,
} from "@/lib/literature/repository";
import type { PubMedArticle } from "@/lib/literature/types";

const article: PubMedArticle = {
  pmid: "77777777",
  doi: "10.1000/repository-fixture",
  title: "Repository fixture title",
  abstract: "Fixture abstract",
  journal: "Fixture Journal",
  publicationYear: 2022,
  authors: ["Tester A", "Tester B"],
  url: "https://pubmed.ncbi.nlm.nih.gov/77777777/",
  sourceName: "PubMed",
  fetchedAt: new Date().toISOString(),
};

afterEach(async () => {
  await prisma.literatureRecord.deleteMany({ where: { pmid: { in: ["77777777", "88888888"] } } });
});

describe("literature repository", () => {
  it("upserts LiteratureRecord by PMID without duplicates", async () => {
    await upsertLiteratureRecord(prisma, article);
    await upsertLiteratureRecord(prisma, { ...article, title: "Updated fixture title" });

    const rows = await prisma.literatureRecord.findMany({ where: { pmid: article.pmid } });
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Updated fixture title");
    expect(rows[0].authorsJson).toEqual(["Tester A", "Tester B"]);
  });

  it("reads cached LiteratureRecord rows within the TTL", async () => {
    await upsertLiteratureRecords(prisma, [article]);

    const cached = await getCachedLiteratureRecords(prisma, [article.pmid], 86_400);

    expect(cached[0]).toMatchObject({ pmid: article.pmid, title: article.title });
  });

  it("stores LiteratureEvidence linked to Gene and PhenotypeTerm idempotently", async () => {
    const gene = await prisma.gene.findUniqueOrThrow({ where: { symbol: "SCN2A" } });
    const term = await prisma.phenotypeTerm.findUniqueOrThrow({ where: { hpoId: "HP:0001250" } });

    await attachLiteratureEvidence({
      prisma,
      articles: [article],
      geneId: gene.id,
      phenotypeTermIds: [term.id],
      evidenceType: "PUBMED_GENE_PHENOTYPE",
      sourceQuery: '"SCN2A"[Title/Abstract] AND "Seizure"[Title/Abstract]',
    });
    await attachLiteratureEvidence({
      prisma,
      articles: [article],
      geneId: gene.id,
      phenotypeTermIds: [term.id],
      evidenceType: "PUBMED_GENE_PHENOTYPE",
      sourceQuery: '"SCN2A"[Title/Abstract] AND "Seizure"[Title/Abstract]',
    });

    const record = await prisma.literatureRecord.findUniqueOrThrow({
      where: { pmid: article.pmid },
    });
    const evidence = await prisma.literatureEvidence.findMany({
      where: { literatureRecordId: record.id, geneId: gene.id, phenotypeTermId: term.id },
    });

    expect(evidence).toHaveLength(1);
    expect(evidence[0].sourceQuery).toContain("SCN2A");
  });
});
