"use client";

import { useEffect, useMemo, useState } from "react";

import { DataStatusCard } from "@/components/data/DataStatusCard";
import { ExportButtons } from "@/components/export/ExportButtons";
import { GeneDetailDrawer } from "@/components/results/GeneDetailDrawer";
import { RankingResults } from "@/components/results/RankingResults";
import { Card } from "@/components/ui/Card";
import {
  extractPhenotypes,
  getDataVersions,
  getHealth,
  getHpoTerm,
  prioritizeGenes,
  validateGenes,
} from "@/lib/client/api";
import type { DataVersionData, HealthData } from "@/lib/client/types";
import type { GeneValidationResult } from "@/lib/genes/types";
import type { PhenotypeExtractionResult } from "@/lib/phenotype/types";
import type { PublicRankedGene, RankingResponseData } from "@/lib/ranking/types";

import { AdvancedOptions, type RankingOptionsState } from "./AdvancedOptions";
import { CandidateGeneInput } from "./CandidateGeneInput";
import { FreeTextInput } from "./FreeTextInput";
import { HpoCodeInput } from "./HpoCodeInput";
import { InputTabs, type InputTabId } from "./InputTabs";
import {
  getDefaultConfirmedTerms,
  PhenotypeConfirmationPanel,
  type ConfirmedHpoSelection,
} from "./PhenotypeConfirmationPanel";
import { PrioritizeButton } from "./PrioritizeButton";
import { parseGeneSymbols } from "./utils";

const initialOptions: RankingOptionsState = {
  rankingMode: "CANDIDATE_BOOSTED",
  limit: 10,
  storeResults: false,
  privacyMode: true,
  includeLiterature: false,
  literatureRetmax: 3,
  literatureSummaries: false,
};

function uniqueTerms(terms: ConfirmedHpoSelection[]): ConfirmedHpoSelection[] {
  const seen = new Set<string>();
  return terms.filter((term) => {
    if (seen.has(term.hpoId)) return false;
    seen.add(term.hpoId);
    return true;
  });
}

function groupsFromExtraction(extraction: PhenotypeExtractionResult | null) {
  return [
    {
      title: "Present phenotypes",
      status: "PRESENT",
      terms: extraction?.terms ?? [],
      defaultIncluded: true,
    },
    {
      title: "Negated phenotypes",
      status: "NEGATED",
      terms: extraction?.negatedTerms ?? [],
      defaultIncluded: false,
    },
    {
      title: "Uncertain phenotypes",
      status: "UNCERTAIN",
      terms: extraction?.uncertainTerms ?? [],
      defaultIncluded: false,
    },
    {
      title: "Family-history-only phenotypes",
      status: "FAMILY_HISTORY",
      terms: extraction?.familyHistoryTerms ?? [],
      defaultIncluded: false,
    },
    {
      title: "Unmapped phrases",
      status: "UNMAPPED",
      terms: extraction?.unmappedTerms ?? [],
      defaultIncluded: false,
    },
  ];
}

function createReportInput(
  ranking: RankingResponseData | null,
  confirmedTerms: ConfirmedHpoSelection[],
  candidateGenes: GeneValidationResult[],
  inputMode: "free_text" | "hpo_codes" | "mixed",
  build: HealthData["build"] | undefined,
) {
  if (!ranking) return null;
  return {
    appVersion: build?.appVersion ?? "0.1.0",
    build,
    inputSummary: {
      inputMode,
      rawTextIncluded: false,
      hpoTermCount: confirmedTerms.length,
      candidateGeneCount: candidateGenes.length,
    },
    confirmedHpoTerms: ranking.confirmedHpoTerms.map((term) => ({
      hpoId: term.hpoId,
      label: term.label,
    })),
    candidateGenes: ranking.candidateGenes,
    rankingMode: ranking.rankingMode,
    algorithmVersion: ranking.algorithmVersion,
    dataSourceVersions: ranking.dataVersions,
    rankedResults: ranking.results,
    warnings: ranking.warnings,
    literatureIncluded: ranking.results.some((result) => Boolean(result.literatureEvidence)),
    disclaimer: ranking.disclaimer,
  };
}

export function GenePrioritizerWorkflow() {
  const [activeTab, setActiveTab] = useState<InputTabId>("free-text");
  const [freeText, setFreeText] = useState("");
  const [useLLM, setUseLLM] = useState(false);
  const [hpoText, setHpoText] = useState("");
  const [candidateGeneText, setCandidateGeneText] = useState("");
  const [extraction, setExtraction] = useState<PhenotypeExtractionResult | null>(null);
  const [confirmedTerms, setConfirmedTerms] = useState<ConfirmedHpoSelection[]>([]);
  const [candidateResults, setCandidateResults] = useState<GeneValidationResult[]>([]);
  const [options, setOptions] = useState<RankingOptionsState>(initialOptions);
  const [ranking, setRanking] = useState<RankingResponseData | null>(null);
  const [selectedGene, setSelectedGene] = useState<PublicRankedGene | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [versions, setVersions] = useState<DataVersionData | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("Ready.");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    void Promise.allSettled([getHealth(), getDataVersions()]).then(
      ([healthResult, versionResult]) => {
        if (healthResult.status === "fulfilled") setHealth(healthResult.value.data);
        if (versionResult.status === "fulfilled") setVersions(versionResult.value.data);
      },
    );
  }, []);

  const groups = useMemo(() => groupsFromExtraction(extraction), [extraction]);
  const reportInput = useMemo(() => {
    const mode =
      freeText.trim() && hpoText.trim() ? "mixed" : freeText.trim() ? "free_text" : "hpo_codes";
    return createReportInput(ranking, confirmedTerms, candidateResults, mode, health?.build);
  }, [candidateResults, confirmedTerms, freeText, health?.build, hpoText, ranking]);

  async function handleExtract() {
    setError(null);
    setWarnings([]);
    setLoading("extract");
    setMessage("Extracting candidate HPO terms from text.");
    try {
      const response = await extractPhenotypes(freeText, useLLM);
      setExtraction(response.data);
      const nextGroups = groupsFromExtraction(response.data);
      setConfirmedTerms((current) =>
        uniqueTerms([...current, ...getDefaultConfirmedTerms(nextGroups)]),
      );
      setWarnings(response.warnings.concat(response.data.warnings));
      setMessage("Extraction complete. Review and confirm HPO terms before ranking.");
    } catch (caught) {
      const apiError = caught as Error & { warnings?: string[] };
      setError(apiError.message || "Unable to extract HPO terms.");
      setWarnings(apiError.warnings ?? []);
    } finally {
      setLoading(null);
    }
  }

  async function handleAddCodes(codes: string[]) {
    setError(null);
    setLoading("hpo");
    setMessage("Validating HPO codes against the local ontology.");
    try {
      const lookups = await Promise.allSettled(codes.map((code) => getHpoTerm(code)));
      const validTerms: ConfirmedHpoSelection[] = [];
      const lookupWarnings: string[] = [];

      lookups.forEach((lookup, index) => {
        const hpoId = codes[index];
        if (lookup.status === "fulfilled") {
          const term = lookup.value.data;
          validTerms.push({
            hpoId,
            label: term.label ?? null,
            source: "manual",
          });
          if (term.isObsolete) {
            lookupWarnings.push(
              `${hpoId} is marked obsolete${term.replacedBy ? `; replacement: ${term.replacedBy}` : ""}.`,
            );
          }
          return;
        }
        lookupWarnings.push(`${hpoId} was not found in the local HPO database.`);
      });

      setConfirmedTerms((current) => uniqueTerms([...current, ...validTerms]));
      setWarnings((current) => Array.from(new Set([...current, ...lookupWarnings])));
      setMessage(
        validTerms.length > 0
          ? "Validated HPO codes were added to the confirmed ranking list."
          : "No submitted HPO codes were found in the local ontology.",
      );
    } finally {
      setLoading(null);
    }
  }

  function handleToggleTerm(term: ConfirmedHpoSelection, checked: boolean) {
    setConfirmedTerms((current) =>
      checked
        ? uniqueTerms([...current, term])
        : current.filter((confirmed) => confirmed.hpoId !== term.hpoId),
    );
  }

  async function handleValidateGenes(genes: string[]) {
    setError(null);
    setLoading("genes");
    setMessage("Validating candidate gene nomenclature.");
    try {
      const response = await validateGenes(genes);
      setCandidateResults(response.data.results);
      setWarnings(response.warnings);
      setMessage("Candidate gene validation complete.");
    } catch (caught) {
      const apiError = caught as Error & { warnings?: string[] };
      setError(apiError.message || "Unable to validate candidate genes.");
      setWarnings(apiError.warnings ?? []);
    } finally {
      setLoading(null);
    }
  }

  async function handlePrioritize() {
    setError(null);
    setLoading("prioritize");
    setMessage(
      options.includeLiterature
        ? "Validating terms, ranking genes, and retrieving PubMed literature if available."
        : "Validating terms and ranking genes deterministically.",
    );
    try {
      const parsedGenes = parseGeneSymbols(candidateGeneText).valid;
      let activeCandidateResults = candidateResults;
      if (parsedGenes.length > 0) {
        setMessage("Validating candidate genes before deterministic ranking.");
        const validation = await validateGenes(parsedGenes);
        activeCandidateResults = validation.data.results;
        setCandidateResults(activeCandidateResults);
      }
      const excludedInvalidGenes = activeCandidateResults
        .filter((gene) => gene.status === "INVALID")
        .map((gene) => gene.input);
      const canonicalGenes =
        activeCandidateResults.length > 0
          ? activeCandidateResults
              .filter((gene) => gene.status !== "INVALID")
              .map((gene) => gene.canonicalSymbol ?? gene.normalizedInput)
              .filter((symbol): symbol is string => Boolean(symbol))
          : parsedGenes;
      const response = await prioritizeGenes({
        hpoTerms: confirmedTerms.map((term) => term.hpoId),
        candidateGenes: canonicalGenes,
        rankingMode: options.rankingMode,
        limit: options.limit,
        storeResults: options.storeResults,
        privacyMode: options.privacyMode,
        includeLiterature: options.includeLiterature,
        literatureRetmax: options.literatureRetmax,
        literatureSummaries: options.literatureSummaries,
        metadata: { uiPhase: "phase-8" },
      });
      setRanking(response.data);
      setWarnings(
        response.warnings.concat(
          response.data.warnings,
          response.data.literatureWarnings ?? [],
          excludedInvalidGenes.length > 0
            ? [`Invalid candidate genes excluded: ${excludedInvalidGenes.join(", ")}`]
            : [],
        ),
      );
      setMessage("Ranking complete. Review score breakdowns, evidence, and export options.");
    } catch (caught) {
      const apiError = caught as Error & { warnings?: string[] };
      setError(apiError.message || "Unable to prioritize genes.");
      setWarnings(apiError.warnings ?? []);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-8">
      <Card className="space-y-5">
        <InputTabs activeTab={activeTab} onChange={setActiveTab} />
        {activeTab === "free-text" ? (
          <FreeTextInput
            value={freeText}
            useLLM={useLLM}
            loading={loading === "extract"}
            maxLength={health?.phenotypeExtraction.maxTextChars ?? 5_000}
            onChange={setFreeText}
            onUseLLMChange={setUseLLM}
            onExtract={handleExtract}
          />
        ) : null}
        {activeTab === "hpo-codes" ? (
          <HpoCodeInput
            value={hpoText}
            confirmedTerms={confirmedTerms.map((term) => ({
              hpoId: term.hpoId,
              label: term.label,
            }))}
            loading={loading === "hpo"}
            onChange={setHpoText}
            onAddCodes={handleAddCodes}
            onRemoveCode={(code) =>
              setConfirmedTerms((current) => current.filter((term) => term.hpoId !== code))
            }
          />
        ) : null}
        {activeTab === "candidate-genes" ? (
          <CandidateGeneInput
            value={candidateGeneText}
            validationResults={candidateResults}
            loading={loading === "genes"}
            onChange={setCandidateGeneText}
            onValidate={handleValidateGenes}
            onRemoveGene={(input) =>
              setCandidateResults((current) => current.filter((gene) => gene.input !== input))
            }
          />
        ) : null}
        {activeTab === "advanced-options" ? (
          <AdvancedOptions
            options={options}
            literatureSummariesAvailable={false}
            onChange={setOptions}
          />
        ) : null}
      </Card>

      <Card>
        <PhenotypeConfirmationPanel
          groups={groups}
          confirmedTerms={confirmedTerms}
          onToggleTerm={handleToggleTerm}
          onRemoveTerm={(hpoId) =>
            setConfirmedTerms((current) => current.filter((term) => term.hpoId !== hpoId))
          }
        />
      </Card>

      <Card className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-950">Prioritization controls</h2>
        <p className="text-sm text-slate-600">
          Prioritization scores are not clinical probabilities. The deterministic backend ranking
          API is used as-is.
        </p>
        <PrioritizeButton
          confirmedCount={confirmedTerms.length}
          loading={loading === "prioritize"}
          onPrioritize={handlePrioritize}
        />
        <div
          aria-live="polite"
          className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
        >
          {message}
        </div>
        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </p>
        ) : null}
        {warnings.length > 0 ? (
          <ul className="space-y-1 text-sm text-amber-900">
            {Array.from(new Set(warnings)).map((warning) => (
              <li
                key={warning}
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
              >
                {warning}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <RankingResults results={ranking?.results ?? []} onSelectGene={setSelectedGene} />
      <ExportButtons report={reportInput} />
      <DataStatusCard health={health} versions={versions} />
      <GeneDetailDrawer result={selectedGene} onClose={() => setSelectedGene(null)} />
    </div>
  );
}
