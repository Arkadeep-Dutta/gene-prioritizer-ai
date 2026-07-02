"use client";

import type { LicensedGeneCardsAnnotation } from "@/lib/genecards/types";

export function GeneCardsAnnotationPanel({
  annotations,
}: Readonly<{ annotations?: LicensedGeneCardsAnnotation[] }>) {
  if (!annotations?.length) return null;

  return (
    <section className="mt-6">
      <h3 className="text-lg font-semibold text-slate-950">
        Licensed GeneCards/GeneALaCart Annotations
      </h3>
      <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
        These annotations are imported from a user-provided licensed file and are not diagnostic
        evidence.
      </p>
      <div className="mt-3 space-y-3">
        {annotations.map((annotation) => (
          <div
            key={`${annotation.importId}-${annotation.symbol}`}
            className="rounded-xl border border-slate-200 bg-white p-4 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-950">User-provided licensed import</p>
              <p className="text-xs text-slate-500">
                {new Date(annotation.importedAt).toISOString()}
              </p>
            </div>
            <p className="mt-1 text-xs text-slate-600">{annotation.sourceLabel}</p>
            {Object.keys(annotation.fields).length > 0 ? (
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                {Object.entries(annotation.fields).map(([field, value]) => (
                  <div key={field} className="rounded-lg bg-slate-50 p-2">
                    <dt className="text-xs font-semibold uppercase text-slate-500">{field}</dt>
                    <dd className="mt-1 break-words text-slate-800">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 text-slate-600">No displayable fields were stored for this row.</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
