function boolFromEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "true";
}

function intFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getGeneCardsImportConfig(environment: NodeJS.ProcessEnv = process.env) {
  return {
    linkoutEnabled: environment.GENE_CARDS_LINKOUT_ENABLED !== "false",
    licensedImportEnabled: boolFromEnv(environment.GENE_CARDS_LICENSED_IMPORT_ENABLED, false),
    maxBytes: intFromEnv(environment.GENE_CARDS_IMPORT_MAX_BYTES, 5_242_880),
    allowedExtensions: (environment.GENE_CARDS_IMPORT_ALLOWED_EXTENSIONS ?? ".csv,.tsv")
      .split(",")
      .map((extension) => extension.trim().toLowerCase())
      .filter(Boolean),
    requireLicenseConfirmation: boolFromEnv(
      environment.GENE_CARDS_IMPORT_REQUIRE_LICENSE_CONFIRMATION,
      true,
    ),
    storeRawFields: boolFromEnv(environment.GENE_CARDS_IMPORT_STORE_RAW_FIELDS, true),
    maxRows: intFromEnv(environment.GENE_CARDS_IMPORT_MAX_ROWS, 50_000),
    adminOnly: boolFromEnv(environment.GENE_CARDS_IMPORT_ADMIN_ONLY, true),
  };
}
