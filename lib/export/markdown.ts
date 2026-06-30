import { EXPORT_DISCLAIMER, type ReportExportInput } from "./types";

function escapeTableCell(value: unknown): string {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
}

export function createMarkdownReport(input: ReportExportInput): string {
  const timestamp = input.timestamp ?? new Date().toISOString();
  const disclaimer = input.disclaimer ?? EXPORT_DISCLAIMER;
  const lines = [
    "# Gene Prioritizer AI Report",
    "",
    `Generated: ${timestamp}`,
    `App version: ${input.appVersion ?? input.build?.appVersion ?? "unknown"}`,
    input.build?.buildCommitSha ? `Build commit: ${input.build.buildCommitSha}` : null,
    input.build?.buildTime ? `Build time: ${input.build.buildTime}` : null,
    "",
    "## Safety disclaimer",
    "",
    disclaimer,
    "",
    "## Input summary",
    "",
    `- Input mode: ${input.inputSummary.inputMode}`,
    `- Confirmed HPO terms: ${input.confirmedHpoTerms.length}`,
    `- Candidate genes: ${input.candidateGenes.length}`,
    `- Ranking mode: ${input.rankingMode}`,
    `- Algorithm version: ${input.algorithmVersion}`,
    `- Literature included: ${input.literatureIncluded ? "yes" : "no"}`,
    "- Raw clinical text included: no",
    "",
    "## Confirmed HPO terms",
    "",
    "| HPO ID | Label |",
    "| --- | --- |",
    ...input.confirmedHpoTerms.map(
      (term) => `| ${escapeTableCell(term.hpoId)} | ${escapeTableCell(term.label)} |`,
    ),
    "",
    "## Top ranked genes",
    "",
    "| Rank | Gene | Score | Label | Matched phenotypes |",
    "| --- | --- | ---: | --- | ---: |",
    ...input.rankedResults.map(
      (result) =>
        `| ${result.rank} | ${escapeTableCell(result.gene.symbol)} | ${result.score} | ${escapeTableCell(
          result.scoreLabel,
        )} | ${result.matchedPhenotypes.length} |`,
    ),
    "",
    "## Per-gene evidence",
    "",
  ].filter((line): line is string => line !== null);

  for (const result of input.rankedResults) {
    lines.push(`### ${result.rank}. ${result.gene.symbol}`, "");
    lines.push(result.explanation, "");
    if (result.warnings.length > 0) {
      lines.push("Warnings:", ...result.warnings.map((warning) => `- ${warning}`), "");
    }
    if (result.literatureEvidence?.records.length) {
      lines.push("PubMed citations:");
      for (const record of result.literatureEvidence.records) {
        const citation = [record.title, record.journal, record.publicationYear]
          .filter(Boolean)
          .join(". ");
        lines.push(`- PMID ${record.pmid}: ${citation} ${record.url}`);
      }
      lines.push("");
    }
    if (result.gene.licensedGeneCardsAnnotations?.length) {
      lines.push(
        "Licensed GeneCards/GeneALaCart annotations:",
        "- Source: User-provided licensed import",
        "- Note: These annotations are not diagnostic evidence and do not override HPO/HGNC/PubMed evidence.",
      );
      for (const annotation of result.gene.licensedGeneCardsAnnotations) {
        const fieldNames = Object.keys(annotation.fields);
        lines.push(
          `- Import ${escapeTableCell(annotation.importId)}: ${fieldNames.length} displayable field(s)`,
        );
      }
      lines.push("");
    }
  }

  lines.push(
    "## Data source versions",
    "",
    "```json",
    JSON.stringify(input.dataSourceVersions, null, 2),
    "```",
    "",
    "## Limitations",
    "",
    "- Prioritization scores are not clinical probabilities.",
    "- Literature evidence does not prove causality. Absence of PubMed results does not rule out a gene.",
    "- Results require review by qualified genetics professionals.",
  );

  return lines.join("\n").concat("\n");
}
