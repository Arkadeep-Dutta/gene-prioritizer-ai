import Link from "next/link";

export default function Page() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
        Logres Genomic Platform
      </p>
      <h1 className="text-3xl font-semibold">Organization audit</h1>
      <p className="max-w-3xl text-slate-700">
        Audit shell for bounded organization-scoped events without raw phenotype text, tokens, or
        secrets.
      </p>
      <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        Research and education only. Not for diagnosis, treatment, clinical decision-making, or
        submission of identifiable patient data.
      </p>
      <nav className="flex flex-wrap gap-3 text-sm">
        <Link href="/products">Products</Link>
        <Link href="/products/genemed">Genemed</Link>
        <Link href="/app/genemed">Workspace</Link>
      </nav>
    </main>
  );
}
