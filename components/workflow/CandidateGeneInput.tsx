"use client";

import type { GeneValidationResult } from "@/lib/genes/types";

import { parseGeneSymbols } from "./utils";
import { Badge } from "../ui/Badge";

export function CandidateGeneInput({
  value,
  validationResults,
  loading = false,
  onChange,
  onValidate,
  onRemoveGene,
}: Readonly<{
  value: string;
  validationResults: GeneValidationResult[];
  loading?: boolean;
  onChange: (value: string) => void;
  onValidate: (genes: string[]) => void;
  onRemoveGene: (symbol: string) => void;
}>) {
  const parsed = parseGeneSymbols(value);

  return (
    <section id="candidate-genes-panel" role="tabpanel" className="space-y-4">
      <div>
        <label htmlFor="candidate-gene-text" className="text-sm font-semibold text-slate-900">
          Candidate gene symbols
        </label>
        <textarea
          id="candidate-gene-text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 p-3 text-slate-900 shadow-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          placeholder="SCN2A, KCNQ2, CACNA1A"
        />
      </div>
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
        Gene validation confirms nomenclature only. It does not imply disease causality.
      </p>
      {parsed.invalid.length > 0 ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          Invalid gene symbol format: {parsed.invalid.join(", ")}
        </p>
      ) : null}
      <button
        type="button"
        disabled={parsed.valid.length === 0 || loading}
        onClick={() => onValidate(parsed.valid)}
        className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {loading ? "Validating genes…" : "Validate candidate genes"}
      </button>
      {validationResults.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="py-2 pr-4">Input</th>
                <th className="py-2 pr-4">Canonical symbol</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Warnings</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {validationResults.map((gene) => (
                <tr key={gene.input}>
                  <td className="py-2 pr-4">{gene.input}</td>
                  <td className="py-2 pr-4">{gene.canonicalSymbol ?? "—"}</td>
                  <td className="py-2 pr-4">
                    <Badge tone={gene.status === "VALIDATED" ? "green" : "amber"}>
                      {gene.status}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4">{gene.warnings.join("; ") || "—"}</td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => onRemoveGene(gene.input)}
                      className="text-sm font-semibold text-red-700"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
