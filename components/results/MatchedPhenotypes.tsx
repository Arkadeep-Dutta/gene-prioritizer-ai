import type { MatchedPhenotype } from "@/lib/ranking/types";

export function MatchedPhenotypes({ matches }: Readonly<{ matches: MatchedPhenotype[] }>) {
  if (matches.length === 0) {
    return <p className="text-sm text-slate-600">No matched local HPO associations were found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead>
          <tr className="text-left text-slate-600">
            <th className="py-2 pr-4">Input HPO</th>
            <th className="py-2 pr-4">Matched HPO</th>
            <th className="py-2 pr-4">Match type</th>
            <th className="py-2 pr-4">Disease</th>
            <th className="py-2">Evidence</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {matches.map((match) => (
            <tr key={`${match.inputHpoId}-${match.matchedHpoId}-${match.matchType}`}>
              <td className="py-2 pr-4">
                {match.inputHpoId} — {match.inputLabel}
              </td>
              <td className="py-2 pr-4">
                {match.matchedHpoId} — {match.matchedLabel}
              </td>
              <td className="py-2 pr-4">{match.matchType}</td>
              <td className="py-2 pr-4">
                {match.associationEvidence.diseaseName ??
                  match.associationEvidence.diseaseId ??
                  "—"}
              </td>
              <td className="py-2">{match.associationEvidence.evidenceSource ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
