export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 leading-7 text-slate-700">
      <h1 className="text-3xl font-bold text-slate-950">Privacy</h1>
      <p className="mt-4">
        Raw free text is not stored by default and is not placed in browser localStorage or
        sessionStorage. Exports exclude raw clinical text by default.
      </p>
      <p className="mt-4">
        Privacy mode is enabled by default. Optional external LLM extraction is off by default and
        should not be used with identifiable patient information unless deployed in a compliant
        environment. PubMed requests use gene and HPO terms, not raw clinical text.
      </p>
      <p className="mt-4">This repository is not HIPAA-compliant by default.</p>
    </main>
  );
}
