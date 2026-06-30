export const LICENSED_GENECARDS_SOURCE_LABEL =
  "Licensed GeneCards/GeneALaCart user-provided import";

export type GeneCardsDelimiter = "csv" | "tsv";

export type ParsedGeneCardsRow = {
  symbol: string;
  fields: Record<string, string>;
  warnings: string[];
};

export type RejectedGeneCardsRow = {
  rowNumber: number;
  reason: string;
};

export type ParsedGeneCardsFile = {
  rows: ParsedGeneCardsRow[];
  rejectedRows: RejectedGeneCardsRow[];
  detectedDelimiter: GeneCardsDelimiter;
  headers: string[];
  warnings: string[];
};

export type GeneCardsImportInput = {
  originalFilename: string;
  content: string;
  licenseConfirmed: boolean;
  licenseConfirmationText: string;
  sourceLabel?: string;
  notes?: string;
  uploadedByHash?: string | null;
};

export type LicensedGeneCardsAnnotation = {
  symbol: string;
  sourceLabel: typeof LICENSED_GENECARDS_SOURCE_LABEL;
  userProvidedLicensedData: true;
  importId: string;
  importedAt: string | Date;
  fields: Record<string, string>;
  warning: string;
};
