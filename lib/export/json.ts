import { EXPORT_DISCLAIMER, type JsonReport, type ReportExportInput } from "./types";

export function createJsonReport(input: ReportExportInput): JsonReport {
  const generatedAt = input.timestamp ?? new Date().toISOString();
  const rawTextIncluded = Boolean(input.includeRawText && input.rawText);

  const report: JsonReport = {
    ...input,
    generatedAt,
    timestamp: generatedAt,
    disclaimer: input.disclaimer ?? EXPORT_DISCLAIMER,
    inputSummary: {
      ...input.inputSummary,
      rawTextIncluded,
    },
  };

  if (!rawTextIncluded) {
    delete report.rawText;
  }

  return report;
}

export function createJsonReportText(input: ReportExportInput): string {
  return JSON.stringify(createJsonReport(input), null, 2);
}
