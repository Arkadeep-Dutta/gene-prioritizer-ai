export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 leading-7 text-slate-700">
      <h1 className="text-3xl font-bold text-slate-950">About Gene Prioritizer AI</h1>
      <p className="mt-4">
        Gene Prioritizer AI is a research and educational decision-support web application for
        prioritizing genes from confirmed HPO phenotypes. It combines local ontology data,
        HGNC-style nomenclature validation, deterministic ranking, and optional PubMed citation
        support.
      </p>
      <p className="mt-4">
        It is intended for research workflows, education, and expert review support. It is not a
        diagnosis, not medical advice, and not a substitute for qualified clinical genetics review.
      </p>
    </main>
  );
}
