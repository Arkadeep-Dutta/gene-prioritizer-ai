import type { LiteratureEvidenceForGene } from "@/lib/literature/types";

export function LiteratureEvidence({
  evidence,
}: Readonly<{ evidence?: LiteratureEvidenceForGene }>) {
  if (!evidence) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        Literature evidence was not requested or is currently unavailable. Ranking results are still
        shown using local HPO/gene evidence.
      </p>
    );
  }

  if (evidence.records.length === 0) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        No PubMed records were returned for this query. This does not rule out the gene.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Literature evidence does not prove causality. Absence of PubMed results does not rule out a
        gene.
      </p>
      {evidence.records.slice(0, 5).map((record) => (
        <article key={record.pmid} className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="font-semibold text-slate-950">{record.title}</h4>
          <p className="mt-1 text-sm text-slate-600">
            PMID {record.pmid}
            {record.journal ? ` · ${record.journal}` : ""}
            {record.publicationYear ? ` · ${record.publicationYear}` : ""}
          </p>
          {record.authors.length > 0 ? (
            <p className="mt-1 text-sm text-slate-600">
              {record.authors.slice(0, 4).join(", ")}
              {record.authors.length > 4 ? " et al." : ""}
            </p>
          ) : null}
          {record.doi ? <p className="mt-1 text-sm text-slate-600">DOI: {record.doi}</p> : null}
          {record.abstract ? (
            <p className="mt-2 text-sm leading-6 text-slate-700">{record.abstract.slice(0, 260)}</p>
          ) : null}
          {record.summary ? (
            <p className="mt-2 rounded-lg bg-cyan-50 p-3 text-sm text-cyan-900">
              Citation-grounded summary: {record.summary}
            </p>
          ) : null}
          <a
            href={record.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block"
          >
            Open PubMed
          </a>
        </article>
      ))}
    </div>
  );
}
