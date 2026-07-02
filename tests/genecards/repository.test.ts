import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { importLicensedGeneCardsFile } from "@/lib/genecards/importer";
import {
  getGeneCardsImportById,
  getLicensedGeneCardsAnnotationsForGene,
  listGeneCardsImports,
} from "@/lib/genecards/repository";

const originalEnv = { ...process.env };

async function cleanImports() {
  await prisma.licensedGeneCardsGeneAnnotation.deleteMany();
  await prisma.licensedGeneCardsImport.deleteMany();
}

afterEach(async () => {
  process.env = { ...originalEnv };
  await cleanImports();
});

describe("licensed GeneCards repository", () => {
  it("returns labeled safe annotations and capped import metadata", async () => {
    process.env.GENE_CARDS_LICENSED_IMPORT_ENABLED = "true";
    await cleanImports();
    const importResult = await importLicensedGeneCardsFile(prisma, {
      originalFilename: "licensed.tsv",
      content: "GeneCards Symbol\tSynthetic Field\nSCN2A\tSynthetic value",
      licenseConfirmed: true,
      licenseConfirmationText: "Licensed export confirmed.",
    });

    const annotations = await getLicensedGeneCardsAnnotationsForGene(prisma, "SCN2A");
    expect(annotations).toHaveLength(1);
    expect(annotations[0]).toMatchObject({
      sourceLabel: "Licensed GeneCards/GeneALaCart user-provided import",
      userProvidedLicensedData: true,
      fields: { "Synthetic Field": "Synthetic value" },
    });
    expect(annotations[0].warning).toContain("not diagnostic evidence");

    const imports = await listGeneCardsImports(prisma);
    expect("uploadedByHash" in imports[0]).toBe(false);
    expect(imports[0].metadata).toBeTruthy();

    const detail = await getGeneCardsImportById(prisma, importResult.importId);
    expect(detail?.fileHash).toMatch(/^sha256:/);
    expect(detail?.annotations[0].fieldsJson).toMatchObject({
      "Synthetic Field": "Synthetic value",
    });
  });
});
