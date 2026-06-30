"use client";

const DEFAULT_MAX_LENGTH = 5_000;

export function FreeTextInput({
  value,
  useLLM,
  loading = false,
  maxLength = DEFAULT_MAX_LENGTH,
  onChange,
  onUseLLMChange,
  onExtract,
}: Readonly<{
  value: string;
  useLLM: boolean;
  loading?: boolean;
  maxLength?: number;
  onChange: (value: string) => void;
  onUseLLMChange: (value: boolean) => void;
  onExtract: () => void;
}>) {
  const tooLong = value.length > maxLength;

  return (
    <section id="free-text-panel" role="tabpanel" className="space-y-4">
      <div>
        <label htmlFor="phenotype-text" className="text-sm font-semibold text-slate-900">
          Free-text phenotype description
        </label>
        <textarea
          id="phenotype-text"
          value={value}
          maxLength={maxLength + 250}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 min-h-40 w-full rounded-xl border border-slate-300 p-3 text-slate-900 shadow-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          placeholder="Example: Infant with seizures, developmental delay, hypotonia. No microcephaly."
        />
      </div>
      <div className="flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite">
          {value.length}/{maxLength} characters
          {tooLong ? " — too long" : ""}
        </p>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={useLLM}
            onChange={(event) => onUseLLMChange(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-500"
          />
          Optional LLM extraction off by default
        </label>
      </div>
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
        Do not enter identifiable patient information unless deployed in a compliant environment.
        Deterministic extraction works locally and extracted HPO terms must be confirmed before
        ranking.
      </p>
      <button
        type="button"
        disabled={!value.trim() || tooLong || loading}
        onClick={onExtract}
        className="rounded-xl bg-cyan-700 px-4 py-2 font-semibold text-white shadow-sm hover:bg-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {loading ? "Extracting HPO terms…" : "Extract HPO terms"}
      </button>
    </section>
  );
}
