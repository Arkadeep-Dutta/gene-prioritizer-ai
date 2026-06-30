"use client";

import { parseHpoCodes } from "./utils";

export type ConfirmedHpoCodeDisplay = {
  hpoId: string;
  label: string | null;
};

export function HpoCodeInput({
  value,
  confirmedTerms,
  loading = false,
  onChange,
  onAddCodes,
  onRemoveCode,
}: Readonly<{
  value: string;
  confirmedTerms: ConfirmedHpoCodeDisplay[];
  loading?: boolean;
  onChange: (value: string) => void;
  onAddCodes: (codes: string[]) => void | Promise<void>;
  onRemoveCode: (code: string) => void;
}>) {
  const parsed = parseHpoCodes(value);

  return (
    <section id="hpo-codes-panel" role="tabpanel" className="space-y-4">
      <div>
        <label htmlFor="hpo-code-text" className="text-sm font-semibold text-slate-900">
          HPO codes
        </label>
        <textarea
          id="hpo-code-text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 p-3 text-slate-900 shadow-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          placeholder="HP:0001250, HP:0001263"
        />
      </div>
      <p className="text-sm text-slate-600">
        Supports comma, space, or newline separated codes. Example: HP:0001250, HP:0001263.
      </p>
      {parsed.invalid.length > 0 ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          Invalid HPO format: {parsed.invalid.join(", ")}
        </p>
      ) : null}
      <button
        type="button"
        disabled={parsed.valid.length === 0 || loading}
        onClick={() => onAddCodes(parsed.valid)}
        className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {loading ? "Validating HPO codes..." : "Add valid HPO codes"}
      </button>
      {confirmedTerms.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Confirmed HPO list</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {confirmedTerms.map((term) => (
              <li
                key={term.hpoId}
                className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-sm"
              >
                {term.hpoId}
                {term.label ? ` - ${term.label}` : ""}{" "}
                <button
                  type="button"
                  className="ml-2 font-semibold text-cyan-900"
                  onClick={() => onRemoveCode(term.hpoId)}
                  aria-label={`Remove ${term.hpoId}`}
                >
                  x
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
