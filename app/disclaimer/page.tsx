import { EXPORT_DISCLAIMER } from "@/lib/export/types";

export default function DisclaimerPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 leading-7 text-slate-700">
      <h1 className="text-3xl font-bold text-slate-950">Disclaimer</h1>
      <p className="mt-4">{EXPORT_DISCLAIMER}</p>
      <p className="mt-4">
        Reports and exports include this disclaimer. The application does not provide diagnosis,
        treatment recommendations, or clinical probabilities.
      </p>
    </main>
  );
}
