import Link from "next/link";

export default function LegalPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
        Logres legal readiness
      </p>
      <h1 className="mt-3 text-3xl font-semibold">Draft policy and contracting materials</h1>
      <p className="mt-4 text-slate-700">
        These materials are structured drafts for qualified review. They are not legal advice, not
        executed agreements, not insurance evidence, not compliance certification, and not clinical
        authorization. Genemed remains research and education only.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link className="rounded border border-slate-200 p-4" href="/legal/terms">
          Terms draft
        </Link>
        <Link className="rounded border border-slate-200 p-4" href="/legal/privacy">
          Privacy draft
        </Link>
        <Link className="rounded border border-slate-200 p-4" href="/legal/disclaimer">
          Research disclaimer
        </Link>
        <Link className="rounded border border-slate-200 p-4" href="/app/legal">
          Internal readiness workspace
        </Link>
      </div>
    </main>
  );
}
