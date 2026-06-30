import { HpoParseError } from "./errors";
import { compactNullable, normalizeGeneSymbol, normalizeHeader } from "./normalize";
import type { GenePhenotypeAssociationInput, ParsedGeneAssociations } from "./types";
import { assertValidHpoId } from "./validate";

type ColumnSpec = {
  geneSymbol: string[];
  hpoId: string[];
  hpoLabel: string[];
  geneId: string[];
  diseaseId: string[];
  diseaseName: string[];
  evidenceCode: string[];
  evidenceSource: string[];
  reference: string[];
  frequency: string[];
  onset: string[];
  sex: string[];
  modifier: string[];
};

const COLUMN_ALIASES: ColumnSpec = {
  geneSymbol: ["gene_symbol", "genesymbol", "gene", "symbol"],
  hpoId: ["hpo_id", "hpoid", "hpo_term_id", "hpo"],
  hpoLabel: ["hpo_name", "hpo_label", "phenotype", "phenotype_name", "term_name"],
  geneId: ["gene_id", "ncbi_gene_id", "entrez_gene_id", "entrez_id"],
  diseaseId: ["disease_id", "diseaseid", "database_id", "omim_id"],
  diseaseName: ["disease_name", "diseasename", "disease"],
  evidenceCode: ["evidence", "evidence_code", "evidencecode"],
  evidenceSource: ["source", "evidence_source", "evidencesource"],
  reference: ["reference", "references", "pmid", "publication"],
  frequency: ["frequency"],
  onset: ["onset"],
  sex: ["sex"],
  modifier: ["modifier", "modifiers"],
};

function findColumn(headers: string[], aliases: string[]): number {
  return headers.findIndex((header) => aliases.includes(header));
}

function getValue(cells: string[], index: number): string | undefined {
  if (index < 0) return undefined;
  return compactNullable(cells[index]);
}

export function parseGeneAssociationTsvText(
  text: string,
  sourceFile: string,
): ParsedGeneAssociations {
  if (!text.trim()) throw new HpoParseError(`${sourceFile} is empty.`);

  const lines = text.split(/\r?\n/);
  const headerLineIndex = lines.findIndex((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith("!") && trimmed.includes("\t");
  });
  if (headerLineIndex === -1)
    throw new HpoParseError(`${sourceFile} does not contain a TSV header row.`);

  const rawHeaders = lines[headerLineIndex]!.split("\t");
  const headers = rawHeaders.map(normalizeHeader);
  const columns = {
    geneSymbol: findColumn(headers, COLUMN_ALIASES.geneSymbol),
    hpoId: findColumn(headers, COLUMN_ALIASES.hpoId),
    hpoLabel: findColumn(headers, COLUMN_ALIASES.hpoLabel),
    geneId: findColumn(headers, COLUMN_ALIASES.geneId),
    diseaseId: findColumn(headers, COLUMN_ALIASES.diseaseId),
    diseaseName: findColumn(headers, COLUMN_ALIASES.diseaseName),
    evidenceCode: findColumn(headers, COLUMN_ALIASES.evidenceCode),
    evidenceSource: findColumn(headers, COLUMN_ALIASES.evidenceSource),
    reference: findColumn(headers, COLUMN_ALIASES.reference),
    frequency: findColumn(headers, COLUMN_ALIASES.frequency),
    onset: findColumn(headers, COLUMN_ALIASES.onset),
    sex: findColumn(headers, COLUMN_ALIASES.sex),
    modifier: findColumn(headers, COLUMN_ALIASES.modifier),
  };

  const missing = [];
  if (columns.geneSymbol < 0) missing.push("gene symbol");
  if (columns.hpoId < 0) missing.push("HPO ID");
  if (missing.length) {
    throw new HpoParseError(`${sourceFile} is missing required column(s): ${missing.join(", ")}.`);
  }

  const warnings: string[] = [];
  const seen = new Set<string>();
  const associations: GenePhenotypeAssociationInput[] = [];

  for (let index = headerLineIndex + 1; index < lines.length; index += 1) {
    const rawLine = lines[index]!;
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("!")) continue;

    const cells = rawLine.split("\t").map((cell) => cell.trim());
    const geneSymbolRaw = getValue(cells, columns.geneSymbol);
    const hpoIdRaw = getValue(cells, columns.hpoId);
    if (!geneSymbolRaw || !hpoIdRaw) {
      warnings.push(`${sourceFile}:${index + 1} skipped because gene symbol or HPO ID is blank.`);
      continue;
    }

    const geneSymbol = normalizeGeneSymbol(geneSymbolRaw);
    const hpoId = assertValidHpoId(hpoIdRaw);
    const diseaseId = getValue(cells, columns.diseaseId);
    const evidenceSource = getValue(cells, columns.evidenceSource) ?? sourceFile;
    const key = [geneSymbol, hpoId, diseaseId ?? "", evidenceSource].join("|");
    if (seen.has(key)) continue;
    seen.add(key);

    associations.push({
      geneSymbol,
      hpoId,
      hpoLabel: getValue(cells, columns.hpoLabel),
      geneId: getValue(cells, columns.geneId),
      diseaseId,
      diseaseName: getValue(cells, columns.diseaseName),
      evidenceCode: getValue(cells, columns.evidenceCode),
      evidenceSource,
      reference: getValue(cells, columns.reference),
      frequency: getValue(cells, columns.frequency),
      onset: getValue(cells, columns.onset),
      sex: getValue(cells, columns.sex),
      modifier: getValue(cells, columns.modifier),
      sourceFile,
    });
  }

  return { associations, warnings };
}
