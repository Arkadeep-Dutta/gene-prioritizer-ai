export default function MethodologyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 leading-7 text-slate-700">
      <h1 className="text-3xl font-bold text-slate-950">Methodology</h1>
      <p className="mt-4">
        Users may provide HPO codes directly or extract candidate HPO terms from free text.
        Extracted terms are suggestions and must be confirmed before ranking.
      </p>
      <p className="mt-4">
        Ranking uses the existing deterministic HPO-to-gene scoring engine. Score breakdowns expose
        exact HPO matches, ancestor matches, specificity, evidence weight, candidate boost,
        literature boost, and penalties. Scores are prioritization scores, not clinical
        probabilities.
      </p>
      <p className="mt-4">
        Optional literature evidence uses PubMed/NCBI responses as citation support. Literature
        counts do not prove causality, and absence of PubMed results does not rule out a gene.
      </p>
    </main>
  );
}
