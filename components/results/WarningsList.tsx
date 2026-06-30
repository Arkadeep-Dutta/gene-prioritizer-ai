export function WarningsList({ warnings }: Readonly<{ warnings: string[] }>) {
  if (warnings.length === 0) return null;

  return (
    <ul className="space-y-1 text-sm text-amber-900">
      {warnings.map((warning) => (
        <li key={warning} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          {warning}
        </li>
      ))}
    </ul>
  );
}
