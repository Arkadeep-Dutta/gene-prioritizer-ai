import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SafetyBanner } from "@/components/layout/SafetyBanner";
import { AdvancedOptions } from "@/components/workflow/AdvancedOptions";
import { CandidateGeneInput } from "@/components/workflow/CandidateGeneInput";
import { FreeTextInput } from "@/components/workflow/FreeTextInput";
import { HpoCodeInput } from "@/components/workflow/HpoCodeInput";
import {
  getDefaultConfirmedTerms,
  PhenotypeConfirmationPanel,
} from "@/components/workflow/PhenotypeConfirmationPanel";
import { parseGeneSymbols, parseHpoCodes } from "@/components/workflow/utils";

import { candidateGene, negatedPhenotypeTerm, phenotypeTerm } from "../fixtures/ui";

describe("workflow UI components", () => {
  it("renders required safety banner language", () => {
    render(<SafetyBanner />);

    expect(screen.getByText(/Research and educational use only/i)).toBeInTheDocument();
    expect(screen.getByText(/Not a diagnosis/i)).toBeInTheDocument();
    expect(screen.getByText(/qualified genetics professionals/i)).toBeInTheDocument();
  });

  it("shows free-text character count and PHI warning", () => {
    render(
      <FreeTextInput
        value="synthetic phenotype"
        useLLM={false}
        maxLength={10}
        onChange={vi.fn()}
        onUseLLMChange={vi.fn()}
        onExtract={vi.fn()}
      />,
    );

    expect(screen.getByText(/19\/10 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/Do not enter identifiable patient information/i)).toBeInTheDocument();
  });

  it("parses comma and newline separated HPO codes", () => {
    expect(parseHpoCodes("HP:0001250,\nHP:0001263 HP0001250 bad")).toEqual({
      valid: ["HP:0001250", "HP:0001263"],
      invalid: ["bad"],
    });
  });

  it("renders HPO code input and adds valid codes", () => {
    const onAddCodes = vi.fn();
    render(
      <HpoCodeInput
        value="HP:0001250, HP:0001263"
        confirmedCodes={[]}
        onChange={vi.fn()}
        onAddCodes={onAddCodes}
        onRemoveCode={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /add valid hpo codes/i }));
    expect(onAddCodes).toHaveBeenCalledWith(["HP:0001250", "HP:0001263"]);
  });

  it("parses and deduplicates candidate gene symbols", () => {
    expect(parseGeneSymbols("scn2a, KCNQ2\nscn2a bad*")).toEqual({
      valid: ["SCN2A", "KCNQ2"],
      invalid: ["bad*"],
    });
  });

  it("renders candidate validation statuses and note", () => {
    render(
      <CandidateGeneInput
        value="SCN2A"
        validationResults={[candidateGene]}
        onChange={vi.fn()}
        onValidate={vi.fn()}
        onRemoveGene={vi.fn()}
      />,
    );

    expect(screen.getByText(/Gene validation confirms nomenclature only/i)).toBeInTheDocument();
    expect(screen.getByText("VALIDATED")).toBeInTheDocument();
    expect(screen.getAllByText("SCN2A").length).toBeGreaterThan(0);
  });

  it("groups extracted phenotypes and excludes negated terms by default", () => {
    const groups = [
      {
        title: "Present phenotypes",
        status: "PRESENT",
        terms: [phenotypeTerm],
        defaultIncluded: true,
      },
      {
        title: "Negated phenotypes",
        status: "NEGATED",
        terms: [negatedPhenotypeTerm],
        defaultIncluded: false,
      },
    ];

    expect(getDefaultConfirmedTerms(groups)).toEqual([
      { hpoId: "HP:0001250", label: "Seizure", source: "free_text" },
    ]);

    render(
      <PhenotypeConfirmationPanel
        groups={groups}
        confirmedTerms={[{ hpoId: "HP:0001250", label: "Seizure", source: "free_text" }]}
        onToggleTerm={vi.fn()}
        onRemoveTerm={vi.fn()}
      />,
    );

    expect(screen.getByText("Present phenotypes")).toBeInTheDocument();
    expect(screen.getByText("Negated phenotypes")).toBeInTheDocument();
    expect(screen.getByText(/Final confirmed HPO list/i)).toBeInTheDocument();
  });

  it("renders advanced ranking modes and literature controls", () => {
    render(
      <AdvancedOptions
        options={{
          rankingMode: "ALL_GENES",
          limit: 10,
          storeResults: false,
          privacyMode: true,
          includeLiterature: false,
          literatureRetmax: 3,
          literatureSummaries: false,
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getAllByText(/ALL_GENES/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/CANDIDATE_ONLY/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Include PubMed literature evidence/i)).toBeInTheDocument();
  });
});
