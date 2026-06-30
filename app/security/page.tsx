export default function SecurityPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 leading-7 text-slate-700">
      <h1 className="text-3xl font-bold text-slate-950">Security</h1>
      <ul className="mt-4 list-disc space-y-3 pl-6">
        <li>No hardcoded secrets are required by the UI.</li>
        <li>Client code does not import Prisma or database internals.</li>
        <li>Inputs use client-side limits and server-side validation.</li>
        <li>Security headers and Content Security Policy are applied by middleware.</li>
        <li>Expensive API routes and admin routes are rate-limited.</li>
        <li>Admin endpoints require a bearer secret and log privacy-safe audit events.</li>
        <li>Audit metadata redacts secrets and omits raw clinical text.</li>
        <li>External links open with safe browser link attributes.</li>
        <li>
          No GeneCards scraping, PubMed page scraping, or article PDF scraping is implemented.
        </li>
        <li>
          Licensed GeneCards/GeneALaCart import requires an admin secret, feature flag, local file
          upload, and explicit license confirmation.
        </li>
      </ul>
    </main>
  );
}
