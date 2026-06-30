"use client";

import type { HpoMappedPhenotype } from "@/lib/phenotype/types";

import { Badge } from "../ui/Badge";

export type ConfirmedHpoSelection = {
  hpoId: string;
  label: string | null;
  source: "free_text" | "manual";
};

type Group = {
  title: string;
  status: string;
  terms: HpoMappedPhenotype[];
  defaultIncluded: boolean;
};

export function getDefaultConfirmedTerms(groups: Group[]): ConfirmedHpoSelection[] {
  const seen = new Set<string>();
  return groups
    .filter((group) => group.defaultIncluded)
    .flatMap((group) => group.terms)
    .filter((term) => Boolean(term.hpoId))
    .filter((term) => {
      if (!term.hpoId || seen.has(term.hpoId)) return false;
      seen.add(term.hpoId);
      return true;
    })
    .map((term) => ({ hpoId: term.hpoId!, label: term.label, source: "free_text" as const }));
}

export function PhenotypeConfirmationPanel({
  groups,
  confirmedTerms,
  onToggleTerm,
  onRemoveTerm,
}: Readonly<{
  groups: Group[];
  confirmedTerms: ConfirmedHpoSelection[];
  onToggleTerm: (term: ConfirmedHpoSelection, checked: boolean) => void;
  onRemoveTerm: (hpoId: string) => void;
}>) {
  const selected = new Set(confirmedTerms.map((term) => term.hpoId));

  return (
    <section className="space-y-5" aria-labelledby="hpo-confirmation-heading">
      <div>
        <h2 id="hpo-confirmation-heading" className="text-xl font-semibold text-slate-950">
          HPO confirmation
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Ranking uses only confirmed HPO terms. Present phenotypes are selected by default;
          negated, uncertain, family-history-only, and unmapped items are not selected by default.
        </p>
      </div>
      {groups.map((group) => (
        <div key={group.status} className="rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-900">{group.title}</h3>
            <Badge tone={group.defaultIncluded ? "green" : "slate"}>
              {group.defaultIncluded ? "included by default" : "excluded by default"}
            </Badge>
          </div>
          {group.terms.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No terms in this group.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {group.terms.map((term, index) => {
                const hpoId = term.hpoId ?? `unmapped-${group.status}-${index}`;
                const disabled = !term.hpoId;
                return (
                  <li key={hpoId} className="rounded-xl bg-slate-50 p-3">
                    <label className="flex gap-3">
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={term.hpoId ? selected.has(term.hpoId) : false}
                        onChange={(event) =>
                          term.hpoId
                            ? onToggleTerm(
                                { hpoId: term.hpoId, label: term.label, source: "free_text" },
                                event.target.checked,
                              )
                            : undefined
                        }
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-500"
                      />
                      <span>
                        <span className="block font-medium text-slate-950">
                          {term.hpoId ?? "Unmapped phrase"} {term.label ? `— ${term.label}` : ""}
                        </span>
                        <span className="mt-1 block text-sm text-slate-600">
                          Source: {term.sourceText || "—"} · Confidence:{" "}
                          {Math.round(term.confidence * 100)}% · Method: {term.mappingMethod}
                        </span>
                        {term.definition ? (
                          <span className="mt-1 block text-sm text-slate-600">
                            {term.definition.slice(0, 180)}
                          </span>
                        ) : null}
                        {term.warnings.length > 0 || term.isObsolete ? (
                          <span className="mt-2 flex flex-wrap gap-2">
                            {term.isObsolete ? <Badge tone="amber">Obsolete</Badge> : null}
                            {term.warnings.map((warning) => (
                              <Badge key={warning} tone="amber">
                                {warning}
                              </Badge>
                            ))}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
      {confirmedTerms.length > 0 ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
          <h3 className="font-semibold text-cyan-950">Final confirmed HPO list for ranking</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {confirmedTerms.map((term) => (
              <li
                key={term.hpoId}
                className="rounded-full bg-white px-3 py-1 text-sm text-cyan-950"
              >
                {term.hpoId}
                {term.label ? ` — ${term.label}` : ""}{" "}
                <button
                  type="button"
                  onClick={() => onRemoveTerm(term.hpoId)}
                  className="ml-2 font-semibold text-red-700"
                  aria-label={`Remove ${term.hpoId}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
