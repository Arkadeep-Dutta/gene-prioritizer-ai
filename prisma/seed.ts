import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const terms = [
  { hpoId: "HP:0000001", label: "All" },
  { hpoId: "HP:0001250", label: "Seizure" },
  { hpoId: "HP:0001263", label: "Global developmental delay" },
  { hpoId: "HP:0001252", label: "Hypotonia" },
  { hpoId: "HP:0001627", label: "Abnormal heart morphology" },
  { hpoId: "HP:0000252", label: "Microcephaly" },
  { hpoId: "HP:0001638", label: "Cardiomyopathy" },
  { hpoId: "HP:0011968", label: "Feeding difficulties" },
] as const;

const genes = [
  { symbol: "SCN2A", name: "sodium voltage-gated channel alpha subunit 2" },
  { symbol: "CACNA1A", name: "calcium voltage-gated channel subunit alpha1 A" },
  { symbol: "KCNQ2", name: "potassium voltage-gated channel subfamily Q member 2" },
  { symbol: "MYH7", name: "myosin heavy chain 7" },
] as const;

export async function seedDatabase(): Promise<void> {
  const source = await prisma.dataSourceVersion.upsert({
    where: { sourceName_version: { sourceName: "SyntheticFixture", version: "1.0.0" } },
    update: { sourceType: "synthetic_test_fixture" },
    create: {
      sourceName: "SyntheticFixture",
      sourceType: "synthetic_test_fixture",
      version: "1.0.0",
      metadata: { purpose: "Phase 2 deterministic development and test fixture" },
    },
  });

  const termByHpoId = new Map<string, { id: string }>();
  for (const term of terms) {
    const saved = await prisma.phenotypeTerm.upsert({
      where: { hpoId: term.hpoId },
      update: { label: term.label, sourceVersionId: source.id },
      create: { ...term, sourceVersionId: source.id },
      select: { id: true },
    });
    termByHpoId.set(term.hpoId, saved);
  }

  const synonyms: Record<string, string[]> = {
    "HP:0001250": ["seizure", "seizures"],
    "HP:0001263": ["developmental delay", "delayed development"],
    "HP:0001252": ["hypotonia", "low muscle tone"],
    "HP:0000252": ["microcephaly", "small head"],
    "HP:0001638": ["cardiomyopathy"],
    "HP:0011968": ["feeding difficulty", "feeding difficulties"],
  };
  for (const [hpoId, values] of Object.entries(synonyms)) {
    const termId = termByHpoId.get(hpoId)!.id;
    for (const synonym of values) {
      await prisma.phenotypeSynonym.upsert({
        where: { termId_synonym: { termId, synonym } },
        update: { source: "SyntheticFixture" },
        create: { termId, synonym, synonymType: "RELATED", source: "SyntheticFixture" },
      });
    }
  }

  const rootId = termByHpoId.get("HP:0000001")!.id;
  for (const term of terms.filter((term) => term.hpoId !== "HP:0000001")) {
    const childTermId = termByHpoId.get(term.hpoId)!.id;
    await prisma.phenotypeRelationship.upsert({
      where: {
        parentTermId_childTermId_relationshipType: {
          parentTermId: rootId,
          childTermId,
          relationshipType: "is_a",
        },
      },
      update: {},
      create: { parentTermId: rootId, childTermId, relationshipType: "is_a" },
    });
  }

  const geneBySymbol = new Map<string, { id: string }>();
  for (const gene of genes) {
    const saved = await prisma.gene.upsert({
      where: { symbol: gene.symbol },
      update: {
        name: gene.name,
        sourceVersionId: source.id,
        isValidated: true,
        validationStatus: "VALIDATED",
      },
      create: {
        ...gene,
        sourceVersionId: source.id,
        isValidated: true,
        validationStatus: "VALIDATED",
      },
      select: { id: true },
    });
    geneBySymbol.set(gene.symbol, saved);
  }

  const associations = [
    ["SCN2A", "HP:0001250"],
    ["SCN2A", "HP:0001263"],
    ["KCNQ2", "HP:0001250"],
    ["CACNA1A", "HP:0001250"],
    ["CACNA1A", "HP:0001252"],
    ["MYH7", "HP:0001627"],
  ] as const;
  for (const [symbol, hpoId] of associations) {
    const geneId = geneBySymbol.get(symbol)!.id;
    const phenotypeTermId = termByHpoId.get(hpoId)!.id;
    const existing = await prisma.genePhenotypeAssociation.findFirst({
      where: { geneId, phenotypeTermId, evidenceSource: "SyntheticFixture" },
      select: { id: true },
    });
    if (!existing) {
      await prisma.genePhenotypeAssociation.create({
        data: {
          geneId,
          phenotypeTermId,
          evidenceSource: "SyntheticFixture",
          evidenceCode: "DEMO",
          sourceVersionId: source.id,
        },
      });
    }
  }
}

export async function disconnectSeedDatabase(): Promise<void> {
  await prisma.$disconnect();
}

async function main(): Promise<void> {
  await seedDatabase();
  console.log("Synthetic Phase 2 fixture data seeded successfully.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .catch((error: unknown) => {
      console.error("Unable to seed the synthetic Phase 2 fixture.", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
