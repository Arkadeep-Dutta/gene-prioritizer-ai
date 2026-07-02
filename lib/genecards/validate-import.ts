import { getGeneCardsImportConfig } from "./config";
import { GeneCardsImportError } from "./errors";

export function validateGeneCardsImportRequest(input: {
  originalFilename: string;
  byteLength: number;
  licenseConfirmed: boolean;
  licenseConfirmationText: string;
  rowCount?: number;
}) {
  const config = getGeneCardsImportConfig();
  if (!config.licensedImportEnabled) {
    throw new GeneCardsImportError(
      "GENECARDS_IMPORT_DISABLED",
      "Licensed GeneCards import is disabled. Set GENE_CARDS_LICENSED_IMPORT_ENABLED=true only if you have permission to import the data.",
      403,
    );
  }

  if (!input.originalFilename.trim()) {
    throw new GeneCardsImportError(
      "GENECARDS_IMPORT_FILE_REQUIRED",
      "A CSV or TSV file is required.",
    );
  }

  const lowerName = input.originalFilename.toLowerCase();
  if (!config.allowedExtensions.some((extension) => lowerName.endsWith(extension))) {
    throw new GeneCardsImportError(
      "GENECARDS_IMPORT_EXTENSION_INVALID",
      "Only CSV and TSV GeneCards/GeneALaCart export files are accepted.",
    );
  }

  if (input.byteLength <= 0) {
    throw new GeneCardsImportError("GENECARDS_IMPORT_EMPTY_FILE", "Uploaded file is empty.");
  }

  if (input.byteLength > config.maxBytes) {
    throw new GeneCardsImportError(
      "GENECARDS_IMPORT_TOO_LARGE",
      "Uploaded GeneCards import file exceeds the configured size limit.",
      413,
    );
  }

  if (config.requireLicenseConfirmation) {
    if (!input.licenseConfirmed) {
      throw new GeneCardsImportError(
        "GENECARDS_LICENSE_NOT_CONFIRMED",
        "Licensed GeneCards import requires explicit license confirmation.",
      );
    }
    if (!input.licenseConfirmationText.trim()) {
      throw new GeneCardsImportError(
        "GENECARDS_LICENSE_TEXT_REQUIRED",
        "Provide license confirmation text before importing GeneCards data.",
      );
    }
  }

  if (input.rowCount !== undefined && input.rowCount > config.maxRows) {
    throw new GeneCardsImportError(
      "GENECARDS_IMPORT_TOO_MANY_ROWS",
      "Uploaded GeneCards import file exceeds the configured row limit.",
    );
  }
}
