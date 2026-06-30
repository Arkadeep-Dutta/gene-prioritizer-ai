import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";

const cleanupTermIds: string[] = [];
const cleanupGeneIds: string[] = [];
const cleanupCaseIds: string[] = [];
const cleanupSourceIds: string[] = [];

afterEach(async () => {
  await prisma.userCase.deleteMany({ where: { id: { in: cleanupCaseIds.splice(0) } } });
  await prisma.phenotypeTerm.deleteMany({ where: { id: { in: cleanupTermIds.splice(0) } } });
  await prisma.gene.deleteMany({ where: { id: { in: cleanupGeneIds.splice(0) } } });
  await prisma.dataSourceVersion.deleteMany({ where: { id: { in: cleanupSourceIds.splice(0) } } });
});

describe("Prisma database foundation", () => {
  it("imports a usable server-side singleton and queries seeded fixtures", async () => {
    const seizure = await prisma.phenotypeTerm.findUnique({ where: { hpoId: "HP:0001250" } });
    const scn2a = await prisma.gene.findUnique({ where: { symbol: "SCN2A" } });

    expect(seizure?.label).toBe("Seizure");
    expect(scn2a?.validationStatus).toBe("VALIDATED");
  });

  it("enforces unique HPO identifiers", async () => {
    const created = await prisma.phenotypeTerm.create({
      data: { hpoId: "HP:TEST0001", label: "Synthetic uniqueness fixture" },
    });
    cleanupTermIds.push(created.id);

    await expect(
      prisma.phenotypeTerm.create({
        data: { hpoId: "HP:TEST0001", label: "Duplicate synthetic fixture" },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("enforces unique gene symbols", async () => {
    const created = await prisma.gene.create({ data: { symbol: "SYNTHETIC_GENE_TEST" } });
    cleanupGeneIds.push(created.id);

    await expect(
      prisma.gene.create({ data: { symbol: "SYNTHETIC_GENE_TEST" } }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });

  it("links genes and phenotype terms through seeded associations", async () => {
    const association = await prisma.genePhenotypeAssociation.findFirst({
      where: { gene: { symbol: "SCN2A" }, phenotypeTerm: { hpoId: "HP:0001250" } },
      include: { gene: true, phenotypeTerm: true },
    });

    expect(association?.gene.symbol).toBe("SCN2A");
    expect(association?.phenotypeTerm.hpoId).toBe("HP:0001250");
    expect(association?.evidenceSource).toBe("SyntheticFixture");
  });

  it("stores normalized case data without raw clinical text and defaults to privacy mode", async () => {
    const userCase = await prisma.userCase.create({
      data: {
        inputHash: `synthetic-test-${crypto.randomUUID()}`,
        inputType: "HPO_CODES",
        hpoTermsJson: ["HP:0001250"],
      },
    });
    cleanupCaseIds.push(userCase.id);

    expect(userCase.privacyMode).toBe(true);
    expect(userCase.rawTextStored).toBe(false);
    expect(userCase.consentToStoreRawText).toBe(false);
    expect(userCase.rawTextRedacted).toBeNull();
    expect(userCase.hpoTermsJson).toEqual(["HP:0001250"]);
  });

  it("creates and reads source provenance", async () => {
    const source = await prisma.dataSourceVersion.create({
      data: {
        sourceName: `SyntheticTest-${crypto.randomUUID()}`,
        sourceType: "synthetic_test_fixture",
        version: "test-only",
      },
    });
    cleanupSourceIds.push(source.id);

    await expect(
      prisma.dataSourceVersion.findUnique({ where: { id: source.id } }),
    ).resolves.toMatchObject({
      sourceType: "synthetic_test_fixture",
      version: "test-only",
    });
  });

  it("keeps licensed GeneCards storage empty in the seed fixture", async () => {
    const [imports, annotations] = await Promise.all([
      prisma.licensedGeneCardsImport.count(),
      prisma.licensedGeneCardsGeneAnnotation.count(),
    ]);

    expect(imports).toBe(0);
    expect(annotations).toBe(0);
  });
});
