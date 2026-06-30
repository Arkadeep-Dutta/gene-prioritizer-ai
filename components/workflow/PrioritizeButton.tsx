"use client";

export function PrioritizeButton({
  confirmedCount,
  loading = false,
  onPrioritize,
}: Readonly<{ confirmedCount: number; loading?: boolean; onPrioritize: () => void }>) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={confirmedCount === 0 || loading}
        onClick={onPrioritize}
        className="w-full rounded-2xl bg-cyan-700 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
      >
        {loading ? "Prioritizing genes…" : "Prioritize genes"}
      </button>
      {confirmedCount === 0 ? (
        <p className="text-sm text-red-700">Add or confirm at least one HPO term before ranking.</p>
      ) : (
        <p className="text-sm text-slate-600">
          {confirmedCount} confirmed HPO term{confirmedCount === 1 ? "" : "s"} will be sent to the
          deterministic ranking API.
        </p>
      )}
    </div>
  );
}
