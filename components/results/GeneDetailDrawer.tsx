"use client";

import type { PublicRankedGene } from "@/lib/ranking/types";

import { GeneCardsAnnotationPanel } from "./GeneCardsAnnotationPanel";
import { LiteratureEvidence } from "./LiteratureEvidence";
import { MatchedPhenotypes } from "./MatchedPhenotypes";
import { ScoreBreakdown } from "./ScoreBreakdown";
import { WarningsList } from "./WarningsList";

function ExternalLink({ href, label }: Readonly<{ href?: string; label: string }>) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm">
      {label}
    </a>
  );
}

export function GeneDetailDrawer({
  result,
  onClose,
}: Readonly<{ result: PublicRankedGene | null; onClose: () => void }>) {
  if (!result) return null;
  const links = result.gene.links;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gene-detail-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4"
    >
      <div className="ml-auto min-h-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
              Gene detail
            </p>
            <h2 id="gene-detail-title" className="mt-1 text-2xl font-bold text-slate-950">
              {result.gene.symbol}
            </h2>
            <p className="mt-1 text-slate-600">
              {result.gene.name ?? "No local gene name available"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold"
          >
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <p>
            <strong>Validation status:</strong> {result.gene.validationStatus}
          </p>
          <p>
            <strong>HGNC ID:</strong> {result.gene.hgncId ?? "—"}
          </p>
          <p>
            <strong>Prioritization score:</strong> {result.score} ({result.scoreLabel})
          </p>
          <p>
            <strong>Candidate gene:</strong> {result.isCandidateGene ? "yes" : "no"}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <ExternalLink href={links?.hgnc} label="HGNC" />
          <ExternalLink href={links?.ncbiGene} label="NCBI Gene" />
          <ExternalLink href={links?.clinVarSearch} label="ClinVar search" />
          <ExternalLink href={links?.pubMedSearch} label="PubMed search" />
          <ExternalLink href={links?.geneCards} label="GeneCards linkout" />
        </div>

        <section className="mt-6">
          <h3 className="text-lg font-semibold text-slate-950">Score breakdown</h3>
          <div className="mt-3">
            <ScoreBreakdown breakdown={result.scoreBreakdown} />
          </div>
        </section>

        <section className="mt-6">
          <h3 className="text-lg font-semibold text-slate-950">Matched phenotypes</h3>
          <div className="mt-3">
            <MatchedPhenotypes matches={result.matchedPhenotypes} />
          </div>
        </section>

        <section className="mt-6">
          <h3 className="text-lg font-semibold text-slate-950">PubMed literature evidence</h3>
          <div className="mt-3">
            <LiteratureEvidence evidence={result.literatureEvidence} />
          </div>
        </section>

        <GeneCardsAnnotationPanel annotations={result.gene.licensedGeneCardsAnnotations} />

        <section className="mt-6">
          <h3 className="text-lg font-semibold text-slate-950">Warnings and limitations</h3>
          <div className="mt-3">
            <WarningsList warnings={result.warnings} />
          </div>
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Not a diagnosis. Expert review by qualified genetics professionals is required.
          </p>
        </section>
      </div>
    </div>
  );
}
