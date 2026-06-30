"use client";

import { createCsvReport } from "@/lib/export/csv";
import { createJsonReportText } from "@/lib/export/json";
import { createMarkdownReport } from "@/lib/export/markdown";
import type { ReportExportInput } from "@/lib/export/types";

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ExportButtons({ report }: Readonly<{ report: ReportExportInput | null }>) {
  const disabled = !report || report.rankedResults.length === 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-950">Export report</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Exports exclude raw clinical text by default. Reports include safety disclaimers and score
        breakdowns.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            report
              ? downloadText(
                  "gene-prioritizer-report.json",
                  createJsonReportText(report),
                  "application/json",
                )
              : undefined
          }
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Export JSON
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            report
              ? downloadText("gene-prioritizer-results.csv", createCsvReport(report), "text/csv")
              : undefined
          }
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Export CSV
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            report
              ? downloadText(
                  "gene-prioritizer-report.md",
                  createMarkdownReport(report),
                  "text/markdown",
                )
              : undefined
          }
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Export Markdown
        </button>
      </div>
    </section>
  );
}
