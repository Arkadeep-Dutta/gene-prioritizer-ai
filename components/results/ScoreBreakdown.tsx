import type { ScoreBreakdown as ScoreBreakdownType } from "@/lib/ranking/types";

const labels: Array<[keyof ScoreBreakdownType, string]> = [
  ["exactHpoMatch", "Exact HPO match"],
  ["ancestorHpoMatch", "Ancestor HPO match"],
  ["specificityWeight", "Specificity weight"],
  ["evidenceWeight", "Evidence weight"],
  ["candidateBoost", "Candidate boost"],
  ["literatureBoost", "Literature boost"],
  ["penalties", "Penalties"],
];

export function ScoreBreakdown({ breakdown }: Readonly<{ breakdown: ScoreBreakdownType }>) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {labels.map(([key, label]) => (
        <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-950">{breakdown[key]}</dd>
        </div>
      ))}
    </dl>
  );
}
