import type { PublicRankedGene } from "@/lib/ranking/types";

import type { ReportExportInput } from "./types";

const columns = [
  "rank",
  "geneSymbol",
  "geneName",
  "score",
  "scoreLabel",
  "validationStatus",
  "exactHpoMatch",
  "ancestorHpoMatch",
  "specificityWeight",
  "evidenceWeight",
  "candidateBoost",
  "literatureBoost",
  "penalties",
  "matchedHpoIds",
  "matchedHpoLabels",
  "warnings",
  "topPubMedPmids",
] as const;

function csvCell(value: unknown): string {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function rowForResult(result: PublicRankedGene): string[] {
  const breakdown = result.scoreBreakdown;
  const matchedHpoIds = result.matchedPhenotypes.map((match) => match.matchedHpoId);
  const matchedHpoLabels = result.matchedPhenotypes.map((match) => match.matchedLabel);
  const pmids = result.literatureEvidence?.records.map((record) => record.pmid).slice(0, 10) ?? [];

  return [
    result.rank,
    result.gene.symbol,
    result.gene.name ?? "",
    result.score,
    result.scoreLabel,
    result.gene.validationStatus,
    breakdown.exactHpoMatch,
    breakdown.ancestorHpoMatch,
    breakdown.specificityWeight,
    breakdown.evidenceWeight,
    breakdown.candidateBoost,
    breakdown.literatureBoost,
    breakdown.penalties,
    matchedHpoIds,
    matchedHpoLabels,
    result.warnings,
    pmids,
  ].map(csvCell);
}

export function createCsvReport(input: Pick<ReportExportInput, "rankedResults">): string {
  return [columns.join(","), ...input.rankedResults.map((result) => rowForResult(result).join(","))]
    .join("\n")
    .concat("\n");
}
