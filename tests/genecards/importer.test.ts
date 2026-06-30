import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { GeneCardsImportError } from "@/lib/genecards/errors";
import { importLicensedGeneCardsFile } from "@/lib/genecards/importer";

const originalEnv = { ...process.env };

function fixture(name: string): string {
  return readFileSync(resolve(process.cwd(), "tests/fixtures/genecards", name), "utf8");
}

async function cleanImports() {
  await prisma.licensedGeneCardsGeneAnnotation.deleteMany();
  await prisma.licensedGeneCardsImport.deleteMany();
}

afterEach(async () => {
  process.env = { ...originalEnv };
  await cleanImports();
});

describe("licensed GeneCards importer", () => {
  it("creates separated import and annotation rows without altering HPO/HGNC evidence", async () => {
    process.env.GENE_CARDS_LICENSED_IMPORT_ENABLED = "true";
    await cleanImports();
    const beforeAssociations = await prisma.genePhenotypeAssociation.count();
    const beforeGene = await prisma.gene.findUniqueOrThrow({ where: { symbol: "SCN2A" } });

    const result = await importLicensedGeneCardsFile(prisma, {
      originalFilename: "licensed-export.fixture.csv",
      content: fixture("licensed-export.fixture.csv"),
      licenseConfirmed: true,
      licenseConfirmationText: "Licensed export confirmed.",
      uploadedByHash: "hash:admin",
    });

    expect(result.acceptedRowCount).toBe(3);
    expect(result.rejectedRowCount).toBe(0);
    expect(result.fileHash).toMatch(/^sha256:/);
    expect(await prisma.licensedGeneCardsImport.count()).toBe(1);
    expect(await prisma.licensedGeneCardsGeneAnnotation.count()).toBe(3);
    expect(await prisma.genePhenotypeAssociation.count()).toBe(beforeAssociations);
    await expect(
      prisma.gene.findUniqueOrThrow({ where: { symbol: "SCN2A" } }),
    ).resolves.toMatchObject({
      id: beforeGene.id,
      isValidated: beforeGene.isValidated,
      validationStatus: beforeGene.validationStatus,
    });
  });

  it("links existing genes and stores symbol-only annotations for unknown symbols", async () => {
    process.env.GENE_CARDS_LICENSED_IMPORT_ENABLED = "true";
    await cleanImports();

    await importLicensedGeneCardsFile(prisma, {
      originalFilename: "licensed-export.fixture.tsv",
      content: fixture("licensed-export.fixture.tsv"),
      licenseConfirmed: true,
      licenseConfirmationText: "Licensed export confirmed.",
    });

    const scn2a = await prisma.licensedGeneCardsGeneAnnotation.findFirstOrThrow({
      where: { symbol: "SCN2A" },
    });
    const unknown = await prisma.licensedGeneCardsGeneAnnotation.findFirstOrThrow({
      where: { symbol: "UNKNOWN1" },
    });

    expect(scn2a.geneId).toEqual(expect.any(String));
    expect(unknown.geneId).toBeNull();
  });

  it("rejects exact duplicate file hashes and binary-looking content", async () => {
    process.env.GENE_CARDS_LICENSED_IMPORT_ENABLED = "true";
    await cleanImports();
    const content = fixture("licensed-export.fixture.tsv");
    const input = {
      originalFilename: "licensed-export.fixture.tsv",
      content,
      licenseConfirmed: true,
      licenseConfirmationText: "Licensed export confirmed.",
    };

    await importLicensedGeneCardsFile(prisma, input);
    await expect(importLicensedGeneCardsFile(prisma, input)).rejects.toMatchObject({
      code: "GENECARDS_IMPORT_DUPLICATE",
    });
    await expect(
      importLicensedGeneCardsFile(prisma, {
        ...input,
        originalFilename: "binary.csv",
        content: "A\0B",
      }),
    ).rejects.toBeInstanceOf(GeneCardsImportError);
  });
});
