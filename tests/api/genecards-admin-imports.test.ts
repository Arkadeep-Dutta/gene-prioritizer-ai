import { afterEach, describe, expect, it } from "vitest";

import { GET as GET_DETAIL } from "@/app/api/admin/genecards/imports/[id]/route";
import { GET as GET_LIST } from "@/app/api/admin/genecards/imports/route";
import { prisma } from "@/lib/db/prisma";
import { importLicensedGeneCardsFile } from "@/lib/genecards/importer";

const originalEnv = { ...process.env };

function adminRequest(secret?: string) {
  return new Request("http://localhost/api/admin/genecards/imports", {
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  });
}

async function cleanImports() {
  await prisma.licensedGeneCardsGeneAnnotation.deleteMany();
  await prisma.licensedGeneCardsImport.deleteMany();
}

async function createImport() {
  process.env.GENE_CARDS_LICENSED_IMPORT_ENABLED = "true";
  return importLicensedGeneCardsFile(prisma, {
    originalFilename: "licensed.tsv",
    content: "GeneCards Symbol\tSynthetic Field\nSCN2A\tSynthetic value",
    licenseConfirmed: true,
    licenseConfirmationText: "Licensed export confirmed.",
    uploadedByHash: "hash:admin",
  });
}

afterEach(async () => {
  process.env = { ...originalEnv };
  await cleanImports();
});

describe("admin GeneCards import list/detail routes", () => {
  it("requires admin authorization", async () => {
    process.env.ADMIN_INGEST_SECRET = "test-admin-secret";

    const list = await GET_LIST(adminRequest());
    const detail = await GET_DETAIL(adminRequest(), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(list.status).toBe(401);
    expect(detail.status).toBe(401);
  });

  it("returns safe list and detail metadata without raw file content or uploader hash", async () => {
    process.env.ADMIN_INGEST_SECRET = "test-admin-secret";
    await cleanImports();
    const result = await createImport();

    const list = await GET_LIST(adminRequest("test-admin-secret"));
    const listBody = await list.json();
    const detail = await GET_DETAIL(adminRequest("test-admin-secret"), {
      params: Promise.resolve({ id: result.importId }),
    });
    const detailBody = await detail.json();
    const serialized = `${JSON.stringify(listBody)} ${JSON.stringify(detailBody)}`;

    expect(list.status).toBe(200);
    expect(listBody.data.imports[0]).toMatchObject({
      originalFilename: "licensed.tsv",
      rowCount: 1,
      hasAnnotations: true,
    });
    expect(detail.status).toBe(200);
    expect(detailBody.data.import.annotationSample[0]).toMatchObject({
      symbol: "SCN2A",
      fieldNames: ["Synthetic Field"],
    });
    expect(serialized).not.toContain("Synthetic value");
    expect(serialized).not.toContain("hash:admin");
    expect(serialized).not.toContain("test-admin-secret");
  });
});
