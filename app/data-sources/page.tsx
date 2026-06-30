export default function DataSourcesPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 leading-7 text-slate-700">
      <h1 className="text-3xl font-bold text-slate-950">Data sources</h1>
      <ul className="mt-4 list-disc space-y-3 pl-6">
        <li>HPO ontology and public HPO gene associations are ingested into the local database.</li>
        <li>HGNC data is used for gene nomenclature validation and alias resolution.</li>
        <li>PubMed/NCBI E-utilities provide optional literature citation evidence.</li>
        <li>ClinVar is provided as a safe external search linkout only.</li>
        <li>GeneCards is linkout only when enabled. The app does not scrape GeneCards.</li>
      </ul>
    </main>
  );
}
