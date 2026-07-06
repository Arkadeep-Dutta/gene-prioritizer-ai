import { GenePrioritizerWorkflow } from "@/components/workflow/GenePrioritizerWorkflow";

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="mb-10 rounded-3xl bg-slate-950 px-6 py-10 text-white shadow-xl sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
          Phase 8 · Integrated UI workflow
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight sm:text-6xl">
          Gene Prioritizer AI
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-200">
          Gene Prioritizer AI ranks candidate genes from confirmed HPO phenotypes using local
          ontology data, gene validation, deterministic scoring, and optional PubMed evidence. It is
          not a diagnostic tool.
        </p>
        <p className="mt-4 max-w-3xl rounded-2xl border border-amber-300/60 bg-amber-200/10 p-4 text-amber-100">
          Research and education only. Not for diagnosis, treatment, or clinical decision-making. Do
          not submit identifiable patient data.
        </p>
      </section>

      <section className="mb-8" aria-label="Workflow overview">
        <ol className="grid gap-3 text-sm font-medium text-slate-700 sm:grid-cols-2 lg:grid-cols-7">
          {[
            "Input",
            "Extract/Validate HPO",
            "Confirm HPO terms",
            "Candidate genes/settings",
            "Prioritize",
            "Review results",
            "Export",
          ].map((step, index) => (
            <li key={step} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <span className="text-cyan-700">{index + 1}.</span> {step}
            </li>
          ))}
        </ol>
      </section>

      <GenePrioritizerWorkflow />
    </main>
  );
}
