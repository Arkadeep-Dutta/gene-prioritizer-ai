import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExportButtons } from "@/components/export/ExportButtons";
import { LiteratureEvidence } from "@/components/results/LiteratureEvidence";
import { RankingResults } from "@/components/results/RankingResults";
import { ScoreBreakdown } from "@/components/results/ScoreBreakdown";

import { rankedGene } from "../fixtures/ui";

describe("results and export components", () => {
  it("renders ranking result rank, gene, score, warnings, and detail action", () => {
    const onSelectGene = vi.fn();
    render(<RankingResults results={[rankedGene]} onSelectGene={onSelectGene} />);

    expect(screen.getByText("Rank 1")).toBeInTheDocument();
    expect(screen.getByText("SCN2A")).toBeInTheDocument();
    expect(screen.getByText("88.5")).toBeInTheDocument();
    expect(screen.getByText("Synthetic test warning")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open gene detail/i }));
    expect(onSelectGene).toHaveBeenCalledWith(rankedGene);
  });

  it("renders all score components", () => {
    render(<ScoreBreakdown breakdown={rankedGene.scoreBreakdown} />);

    expect(screen.getByText("Exact HPO match")).toBeInTheDocument();
    expect(screen.getByText("Ancestor HPO match")).toBeInTheDocument();
    expect(screen.getByText("Literature boost")).toBeInTheDocument();
    expect(screen.getByText("Penalties")).toBeInTheDocument();
  });

  it("renders citation metadata", () => {
    render(<LiteratureEvidence evidence={rankedGene.literatureEvidence} />);

    expect(screen.getByText(/Synthetic citation fixture/i)).toBeInTheDocument();
    expect(screen.getByText(/PMID 12345678/i)).toBeInTheDocument();
    expect(screen.getByText(/Fixture Journal/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open pubmed/i })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
  });

  it("renders export buttons and triggers a download", () => {
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fixture");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(
      <ExportButtons
        report={{
          inputSummary: {
            inputMode: "hpo_codes",
            hpoTermCount: 1,
            candidateGeneCount: 1,
          },
          confirmedHpoTerms: [{ hpoId: "HP:0001250", label: "Seizure" }],
          candidateGenes: [{ input: "SCN2A", canonicalSymbol: "SCN2A", status: "VALIDATED" }],
          rankingMode: "CANDIDATE_BOOSTED",
          algorithmVersion: "fixture-v1",
          dataSourceVersions: {},
          rankedResults: [rankedGene],
          warnings: [],
          literatureIncluded: true,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /export json/i }));
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    click.mockRestore();
  });
});
