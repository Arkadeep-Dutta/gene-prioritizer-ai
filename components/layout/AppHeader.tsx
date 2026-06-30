import Link from "next/link";

import { SafetyBanner } from "./SafetyBanner";

const navItems = [
  { href: "/about", label: "About" },
  { href: "/methodology", label: "Methodology" },
  { href: "/data-sources", label: "Data sources" },
  { href: "/disclaimer", label: "Disclaimer" },
  { href: "/privacy", label: "Privacy" },
  { href: "/security", label: "Security" },
];

export function AppHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <nav className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight text-slate-950 no-underline">
            Gene Prioritizer AI
          </Link>
          <ul className="flex flex-wrap gap-3 text-sm text-slate-700">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <SafetyBanner />
      </div>
    </header>
  );
}
