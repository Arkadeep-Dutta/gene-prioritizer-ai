import type { ReactNode } from "react";

type BadgeTone = "slate" | "cyan" | "green" | "amber" | "red" | "violet";

const toneClasses: Record<BadgeTone, string> = {
  slate: "border-slate-300 bg-slate-100 text-slate-800",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-800",
  green: "border-green-200 bg-green-50 text-green-800",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  red: "border-red-200 bg-red-50 text-red-800",
  violet: "border-violet-200 bg-violet-50 text-violet-800",
};

export function Badge({
  children,
  tone = "slate",
}: Readonly<{ children: ReactNode; tone?: BadgeTone }>) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
