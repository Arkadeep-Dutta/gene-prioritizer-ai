"use client";

const tabs = [
  { id: "free-text", label: "Free Text" },
  { id: "hpo-codes", label: "HPO Codes" },
  { id: "candidate-genes", label: "Candidate Genes" },
  { id: "advanced-options", label: "Advanced Options" },
] as const;

export type InputTabId = (typeof tabs)[number]["id"];

export function InputTabs({
  activeTab,
  onChange,
}: Readonly<{ activeTab: InputTabId; onChange: (tab: InputTabId) => void }>) {
  return (
    <div role="tablist" aria-label="Workflow input sections" className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`${tab.id}-panel`}
          className={`rounded-full border px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
            activeTab === tab.id
              ? "border-cyan-700 bg-cyan-700 text-white"
              : "border-slate-300 bg-white text-slate-700 hover:border-cyan-500"
          }`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
