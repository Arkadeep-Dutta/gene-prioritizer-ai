import { RESEARCH_DISCLAIMER } from "@/lib/safety";

export function SafetyBanner() {
  return (
    <section
      aria-label="Research and medical disclaimer"
      className="rounded-2xl border border-amber-300/60 bg-amber-100 px-5 py-4 text-amber-950 shadow-sm"
    >
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em]">Research use only</h2>
      <p className="mt-2 leading-7">
        Research and educational use only. Not medical advice. Not a diagnosis. Results require
        review by qualified genetics professionals. Do not enter identifiable patient information
        unless deployed in a compliant environment.
      </p>
      <p className="mt-2 leading-7">{RESEARCH_DISCLAIMER}</p>
    </section>
  );
}
