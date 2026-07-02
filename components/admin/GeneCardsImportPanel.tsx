"use client";

import { useState } from "react";

type ImportResult = {
  importId: string | null;
  originalFilename: string | null;
  fileHash: string | null;
  rowCount: number;
  acceptedRowCount: number;
  rejectedRowCount: number;
  warnings: string[];
};

type ImportListItem = {
  importId: string;
  originalFilename: string;
  fileHashPrefix: string;
  licenseConfirmed: boolean;
  importedAt: string;
  rowCount: number;
  hasAnnotations: boolean;
};

type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
  warnings: string[];
  error?: { code: string; message: string };
};

async function readJson<T>(response: Response): Promise<ApiEnvelope<T>> {
  return (await response.json()) as ApiEnvelope<T>;
}

export function GeneCardsImportPanel() {
  const [secret, setSecret] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [licenseConfirmed, setLicenseConfirmed] = useState(false);
  const [licenseText, setLicenseText] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [imports, setImports] = useState<ImportListItem[]>([]);

  async function submitImport() {
    setBusy(true);
    setMessage(null);
    setResult(null);
    try {
      const form = new FormData();
      if (file) form.append("file", file);
      form.append("licenseConfirmed", String(licenseConfirmed));
      form.append("licenseConfirmationText", licenseText);
      form.append("sourceLabel", sourceLabel);
      form.append("notes", notes);

      const response = await fetch("/api/import/genecards", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
        body: form,
      });
      const body = await readJson<ImportResult>(response);
      if (!body.ok) {
        setMessage(
          `${body.error?.code ?? "GENECARDS_IMPORT_FAILED"}: ${body.error?.message ?? "Import failed."}`,
        );
        return;
      }
      setResult(body.data);
      setMessage("Licensed import completed.");
    } catch {
      setMessage("Unable to submit licensed import.");
    } finally {
      setBusy(false);
    }
  }

  async function loadImports() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/genecards/imports", {
        headers: { Authorization: `Bearer ${secret}` },
      });
      const body = await readJson<{ imports: ImportListItem[] }>(response);
      if (!body.ok) {
        setMessage(
          `${body.error?.code ?? "GENECARDS_IMPORTS_UNAVAILABLE"}: ${body.error?.message ?? "Unable to list imports."}`,
        );
        return;
      }
      setImports(body.data.imports);
      setMessage("Recent licensed imports loaded.");
    } catch {
      setMessage("Unable to list licensed imports.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
        Licensed GeneCards/GeneALaCart import
      </p>
      <h2 className="mt-3 text-2xl font-bold text-slate-950">Admin CSV/TSV upload</h2>
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        Import is disabled by default and must only be enabled for legally licensed, admin-uploaded
        GeneCards/GeneALaCart export files. Do not scrape, crawl, fetch, or paste GeneCards web
        pages.
      </div>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Admin bearer secret
          <input
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            autoComplete="off"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Licensed CSV/TSV file
          <input
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
          />
        </label>
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={licenseConfirmed}
            onChange={(event) => setLicenseConfirmed(event.target.checked)}
            className="mt-1"
          />
          <span>
            I confirm this upload is a licensed, user-provided GeneCards/GeneALaCart export and may
            be stored by this deployment.
          </span>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          License confirmation text
          <textarea
            value={licenseText}
            onChange={(event) => setLicenseText(event.target.value)}
            rows={3}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Source label
          <input
            value={sourceLabel}
            onChange={(event) => setSourceLabel(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            placeholder="Optional"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Notes
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={submitImport}
          disabled={busy || !file || !licenseConfirmed || !licenseText.trim()}
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          Upload licensed import
        </button>
        <button
          type="button"
          onClick={loadImports}
          disabled={busy || !secret.trim()}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          List recent imports
        </button>
      </div>

      {message ? <p className="mt-4 text-sm text-slate-700">{message}</p> : null}
      {result ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-950">{result.originalFilename}</p>
          <p className="mt-1 text-slate-700">
            Rows: {result.rowCount}; accepted: {result.acceptedRowCount}; rejected:{" "}
            {result.rejectedRowCount}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {imports.length > 0 ? (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2">File</th>
                <th className="px-2 py-2">Rows</th>
                <th className="px-2 py-2">Hash</th>
                <th className="px-2 py-2">Imported</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((item) => (
                <tr key={item.importId} className="border-t border-slate-200">
                  <td className="px-2 py-2">{item.originalFilename}</td>
                  <td className="px-2 py-2">{item.rowCount}</td>
                  <td className="px-2 py-2">{item.fileHashPrefix}</td>
                  <td className="px-2 py-2">{new Date(item.importedAt).toISOString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
