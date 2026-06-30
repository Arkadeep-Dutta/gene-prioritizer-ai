import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 text-sm leading-6 text-slate-600 sm:px-6 lg:px-8">
        <p>
          Gene Prioritizer AI is a research and educational decision-support application. It is not
          a diagnostic system and does not replace qualified clinical genetics review.
        </p>
        <p className="mt-2">
          Review the <Link href="/disclaimer">disclaimer</Link>,{" "}
          <Link href="/privacy">privacy notes</Link>, and{" "}
          <Link href="/data-sources">data source notes</Link> before use.
        </p>
      </div>
    </footer>
  );
}
