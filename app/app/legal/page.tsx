export default function AppLegalPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-3xl font-semibold">Legal Readiness Workspace</h1>
      <p className="mt-4 text-slate-700">
        Internal synthetic workspace for document registry status, counsel-review blockers, policy
        acceptance readiness, organization agreement gating, insurance inventory, and release
        checks. It does not store executed agreements, signatures, legal opinions, real customer
        records, or insurance policies.
      </p>
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {["Draft documents", "Agreement gates", "Release blockers"].map((item) => (
          <div className="rounded border border-slate-200 p-4" key={item}>
            <h2 className="font-semibold">{item}</h2>
            <p className="mt-2 text-sm text-slate-600">Validated by offline legal CLI commands.</p>
          </div>
        ))}
      </section>
    </main>
  );
}
