import { afterEach, describe, expect, it } from "vitest";

import { GeneCardsImportError } from "@/lib/genecards/errors";
import { validateGeneCardsImportRequest } from "@/lib/genecards/validate-import";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

function validRequest(
  overrides: Partial<Parameters<typeof validateGeneCardsImportRequest>[0]> = {},
) {
  return {
    originalFilename: "licensed.csv",
    byteLength: 20,
    licenseConfirmed: true,
    licenseConfirmationText: "Licensed export confirmed.",
    rowCount: 2,
    ...overrides,
  };
}

describe("GeneCards import validation", () => {
  it("is disabled by default", () => {
    delete process.env.GENE_CARDS_LICENSED_IMPORT_ENABLED;

    expect(() => validateGeneCardsImportRequest(validRequest())).toThrow(
      "Licensed GeneCards import is disabled.",
    );
  });

  it("requires license confirmation and allowed file extensions", () => {
    process.env.GENE_CARDS_LICENSED_IMPORT_ENABLED = "true";

    expect(() => validateGeneCardsImportRequest(validRequest({ licenseConfirmed: false }))).toThrow(
      "Licensed GeneCards import requires explicit license confirmation.",
    );
    expect(() =>
      validateGeneCardsImportRequest(validRequest({ licenseConfirmationText: "" })),
    ).toThrow("Provide license confirmation text");
    expect(() =>
      validateGeneCardsImportRequest(validRequest({ originalFilename: "x.html" })),
    ).toThrow("Only CSV and TSV");
  });

  it("rejects empty, oversized, and too many row uploads", () => {
    process.env.GENE_CARDS_LICENSED_IMPORT_ENABLED = "true";
    process.env.GENE_CARDS_IMPORT_MAX_BYTES = "10";
    process.env.GENE_CARDS_IMPORT_MAX_ROWS = "1";

    expect(() => validateGeneCardsImportRequest(validRequest({ byteLength: 0 }))).toThrow(
      "Uploaded file is empty.",
    );
    expect(() => validateGeneCardsImportRequest(validRequest({ byteLength: 11 }))).toThrow(
      "exceeds the configured size limit",
    );
    expect(() =>
      validateGeneCardsImportRequest(validRequest({ byteLength: 10, rowCount: 2 })),
    ).toThrow("exceeds the configured row limit");
  });

  it("emits typed errors", () => {
    try {
      validateGeneCardsImportRequest(validRequest());
    } catch (error) {
      expect(error).toBeInstanceOf(GeneCardsImportError);
      expect((error as GeneCardsImportError).code).toBe("GENECARDS_IMPORT_DISABLED");
    }
  });
});
