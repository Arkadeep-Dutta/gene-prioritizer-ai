"use client";

import type { PublicRankedGene } from "@/lib/ranking/types";

import { Badge } from "../ui/Badge";
import { ScoreBreakdown } from "./ScoreBreakdown";
import { WarningsList } from "./WarningsList";

export function RankingResults({
  results,
  onSelectGene,
}: Readonly<{ results: PublicRankedGene[]; onSelectGene: (result: PublicRankedGene) => void }>) {
  if (results.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-semibold text-slate-950">Ranking results</h2>
        <p className="mt-2 text-slate-600">No ranked genes are available yet.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="ranking-results-heading">
      <div>
        <h2 id="ranking-results-heading" className="text-xl font-semibold text-slate-950">
          Ranking results
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Prioritization score, not diagnostic probability.
        </p>
      </div>
      <div className="space-y-4">
        {results.map((result) => (
          <article
            key={`${result.rank}-${result.gene.symbol}`}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-cyan-700">Rank {result.rank}</p>
                <h3 className="text-2xl font-bold text-slate-950">{result.gene.symbol}</h3>
                <p className="text-slate-600">{result.gene.name ?? "No local name available"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone="cyan">{result.gene.validationStatus}</Badge>
                  {result.isCandidateGene ? <Badge tone="violet">Candidate gene</Badge> : null}
                  <Badge tone="slate">{result.matchedPhenotypes.length} matched phenotypes</Badge>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-sm text-slate-500">Prioritization score</p>
                <p className="text-3xl font-bold text-slate-950">{result.score}</p>
                <p className="text-sm text-slate-600">{result.scoreLabel}</p>
              </div>
            </div>
            <div className="mt-4">
              <ScoreBreakdown breakdown={result.scoreBreakdown} />
            </div>
            <div className="mt-4">
              <p className="text-sm text-slate-600">
                Top matched HPO terms:{" "}
                {result.matchedPhenotypes
                  .slice(0, 4)
                  .map((match) => `${match.matchedHpoId} ${match.matchedLabel}`)
                  .join("; ") || "none"}
              </p>
            </div>
            <div className="mt-4">
              <WarningsList warnings={result.warnings} />
            </div>
            <button
              type="button"
              onClick={() => onSelectGene(result)}
              aria-expanded={false}
              className="mt-4 rounded-xl border border-cyan-700 px-4 py-2 text-sm font-semibold text-cyan-800 hover:bg-cyan-50 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              Open gene detail
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
