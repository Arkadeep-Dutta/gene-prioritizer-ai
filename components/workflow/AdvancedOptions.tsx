"use client";

import type { RankingMode } from "@/lib/ranking/types";

export type RankingOptionsState = {
  rankingMode: RankingMode;
  limit: number;
  storeResults: boolean;
  privacyMode: boolean;
  includeLiterature: boolean;
  literatureRetmax: number;
  literatureSummaries: boolean;
};

const rankingModes: Array<{ value: RankingMode; label: string; description: string }> = [
  { value: "ALL_GENES", label: "All genes", description: "Rank all locally associated genes." },
  {
    value: "CANDIDATE_ONLY",
    label: "Candidate only",
    description: "Rank only supplied candidate genes.",
  },
  {
    value: "CANDIDATE_BOOSTED",
    label: "Candidate boosted",
    description: "Rank all matches while modestly boosting supplied candidates.",
  },
  { value: "DISCOVERY", label: "Discovery", description: "Broad exploratory ranking mode." },
];

export function AdvancedOptions({
  options,
  literatureSummariesAvailable = false,
  onChange,
}: Readonly<{
  options: RankingOptionsState;
  literatureSummariesAvailable?: boolean;
  onChange: (options: RankingOptionsState) => void;
}>) {
  return (
    <section id="advanced-options-panel" role="tabpanel" className="space-y-5">
      <div>
        <label htmlFor="ranking-mode" className="text-sm font-semibold text-slate-900">
          Ranking mode
        </label>
        <select
          id="ranking-mode"
          value={options.rankingMode}
          onChange={(event) =>
            onChange({ ...options, rankingMode: event.target.value as RankingMode })
          }
          className="mt-2 w-full rounded-xl border border-slate-300 p-3 focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          {rankingModes.map((mode) => (
            <option key={mode.value} value={mode.value}>
              {mode.value} — {mode.label}
            </option>
          ))}
        </select>
        <ul className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
          {rankingModes.map((mode) => (
            <li key={mode.value}>
              <strong>{mode.value}</strong>: {mode.description}
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-900">
          Result limit
          <input
            type="number"
            min={1}
            max={100}
            value={options.limit}
            onChange={(event) => onChange({ ...options, limit: Number(event.target.value) })}
            className="mt-2 w-full rounded-xl border border-slate-300 p-3 focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </label>
        <label className="text-sm font-semibold text-slate-900">
          PubMed records per gene
          <input
            type="number"
            min={1}
            max={25}
            disabled={!options.includeLiterature}
            value={options.literatureRetmax}
            onChange={(event) =>
              onChange({ ...options, literatureRetmax: Number(event.target.value) })
            }
            className="mt-2 w-full rounded-xl border border-slate-300 p-3 focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:bg-slate-100"
          />
        </label>
      </div>
      <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={options.privacyMode}
            onChange={(event) => onChange({ ...options, privacyMode: event.target.checked })}
          />
          Privacy mode default on
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={options.storeResults}
            onChange={(event) => onChange({ ...options, storeResults: event.target.checked })}
          />
          Store ranking result server-side
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={options.includeLiterature}
            onChange={(event) => onChange({ ...options, includeLiterature: event.target.checked })}
          />
          Include PubMed literature evidence
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            disabled={!literatureSummariesAvailable}
            checked={options.literatureSummaries && literatureSummariesAvailable}
            onChange={(event) =>
              onChange({ ...options, literatureSummaries: event.target.checked })
            }
          />
          Literature summaries disabled unless configured
        </label>
      </div>
      <p className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm leading-6 text-cyan-900">
        Literature evidence does not prove causality. Absence of PubMed results does not rule out a
        gene. PubMed enrichment is optional and capped.
      </p>
    </section>
  );
}
