import type { Metadata } from "next";

import { GeneCardsImportPanel } from "@/components/admin/GeneCardsImportPanel";

export const metadata: Metadata = {
  title: "Admin Data Status",
  robots: { index: false, follow: false },
};

export default function AdminDataPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
          Protected admin area
        </p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">Admin data status</h1>
        <p className="mt-4 leading-7 text-slate-700">
          Admin status and data update APIs require an admin bearer secret. This page is noindex and
          does not store secrets in browser storage or URLs.
        </p>
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          Data update controls are intentionally not exposed here. Use the protected API or the
          documented CLI import workflow after rotating ADMIN_INGEST_SECRET in production.
        </div>
      </section>
      <GeneCardsImportPanel />
    </main>
  );
}
