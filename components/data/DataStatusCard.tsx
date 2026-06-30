"use client";

import type { DataVersionData, HealthData } from "@/lib/client/types";

export function DataStatusCard({
  health,
  versions,
}: Readonly<{ health: HealthData | null; versions: DataVersionData | null }>) {
  const counts = health?.data.counts;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-950">Data source and version status</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        This panel uses `/api/health` and `/api/data/version` without exposing secrets, file paths,
        or database URLs.
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">HPO terms</dt>
          <dd className="text-lg font-semibold text-slate-950">{counts?.hpoTerms ?? "—"}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Genes</dt>
          <dd className="text-lg font-semibold text-slate-950">{counts?.genes ?? "—"}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Associations</dt>
          <dd className="text-lg font-semibold text-slate-950">
            {counts?.genePhenotypeAssociations ?? "—"}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">PubMed records</dt>
          <dd className="text-lg font-semibold text-slate-950">
            {health?.literature.recordCount ?? "—"}
          </dd>
        </div>
      </dl>
      <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
        <p>
          Ranking algorithm:{" "}
          {health?.ranking.algorithmVersion ?? versions?.ranking.algorithmVersion ?? "—"}
        </p>
        <p>PubMed module: {health?.literature.enabled ? "enabled" : "disabled or unavailable"}</p>
        <p>HPO imported: {versions?.imported.hpoOntology ? "yes" : "not detected"}</p>
        <p>HGNC tracked: {versions?.imported.hgnc ? "yes" : "not detected"}</p>
      </div>
    </section>
  );
}
