import { normalizeGeneSymbol } from "@/lib/genes/normalize";

import { GeneCardsImportError } from "./errors";
import type { GeneCardsDelimiter, ParsedGeneCardsFile } from "./types";

const SYMBOL_HEADERS = new Set([
  "symbol",
  "gene",
  "gene_symbol",
  "gene symbol",
  "genecards symbol",
  "approved_symbol",
]);

const PATIENT_IDENTIFYING_HEADERS = [
  "patient",
  "name",
  "dob",
  "date_of_birth",
  "mrn",
  "email",
  "phone",
  "address",
];

function normalizeHeader(header: string): string {
  return header.trim().replace(/\s+/g, " ").toLowerCase();
}

function parseDelimitedLine(line: string, delimiter: "," | "\t"): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current);
  return values;
}

function detectDelimiter(headerLine: string): { kind: GeneCardsDelimiter; char: "," | "\t" } {
  const tabs = (headerLine.match(/\t/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return tabs > commas ? { kind: "tsv", char: "\t" } : { kind: "csv", char: "," };
}

export function escapeSpreadsheetFormula(value: string): string {
  const trimmed = value.trim();
  return /^[=+\-@]/.test(trimmed) ? `'${trimmed}` : trimmed;
}

export function parseGeneCardsDelimitedText(content: string): ParsedGeneCardsFile {
  const normalizedContent = content
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const lines = normalizedContent.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    throw new GeneCardsImportError("GENECARDS_IMPORT_EMPTY_FILE", "Uploaded file is empty.");
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseDelimitedLine(lines[0], delimiter.char).map((header) => header.trim());
  const normalizedHeaders = headers.map(normalizeHeader);
  const symbolIndex = normalizedHeaders.findIndex((header) => SYMBOL_HEADERS.has(header));
  if (symbolIndex === -1) {
    throw new GeneCardsImportError(
      "GENECARDS_SYMBOL_COLUMN_MISSING",
      "GeneCards import requires a gene symbol column.",
    );
  }

  const warnings: string[] = [];
  const patientHeaders = normalizedHeaders.filter((header) =>
    PATIENT_IDENTIFYING_HEADERS.some((patientHeader) => header.includes(patientHeader)),
  );
  if (patientHeaders.length > 0) {
    warnings.push(
      `Potential patient-identifying columns detected and excluded: ${patientHeaders.join(", ")}`,
    );
  }

  const rows = [];
  const rejectedRows = [];
  const excludedHeaderIndexes = new Set(
    normalizedHeaders
      .map((header, index) =>
        patientHeaders.includes(header) || header === "" ? index : Number.NaN,
      )
      .filter(Number.isFinite),
  );

  for (let index = 1; index < lines.length; index += 1) {
    const rowNumber = index + 1;
    const values = parseDelimitedLine(lines[index], delimiter.char);
    const symbol = normalizeGeneSymbol(values[symbolIndex] ?? "");
    if (!symbol) {
      rejectedRows.push({ rowNumber, reason: "Missing or invalid gene symbol." });
      continue;
    }

    const fields: Record<string, string> = {};
    const rowWarnings: string[] = [];
    headers.forEach((header, headerIndex) => {
      if (headerIndex === symbolIndex || excludedHeaderIndexes.has(headerIndex)) return;
      const value = escapeSpreadsheetFormula(values[headerIndex] ?? "");
      if (value) fields[header] = value;
      if (/^'?[=+\-@]/.test(value)) {
        rowWarnings.push(`Spreadsheet formula-like value stored as inert text in ${header}.`);
      }
    });

    rows.push({ symbol, fields, warnings: rowWarnings });
  }

  return {
    rows,
    rejectedRows,
    detectedDelimiter: delimiter.kind,
    headers,
    warnings,
  };
}
