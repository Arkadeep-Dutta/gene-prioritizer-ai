import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExportButtons } from "@/components/export/ExportButtons";
import { GeneCardsImportPanel } from "@/components/admin/GeneCardsImportPanel";
import { GeneDetailDrawer } from "@/components/results/GeneDetailDrawer";
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

  it("renders licensed GeneCards annotations with labels and warnings", () => {
    render(
      <GeneDetailDrawer
        result={{
          ...rankedGene,
          gene: {
            ...rankedGene.gene,
            licensedGeneCardsAnnotations: [
              {
                symbol: "SCN2A",
                sourceLabel: "Licensed GeneCards/GeneALaCart user-provided import",
                userProvidedLicensedData: true,
                importId: "import_1",
                importedAt: "2026-06-29T00:00:00.000Z",
                fields: { "Synthetic Field": "Synthetic value" },
                warning:
                  "These annotations are imported from a user-provided licensed file and are not diagnostic evidence.",
              },
            ],
          },
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Licensed GeneCards/GeneALaCart Annotations")).toBeInTheDocument();
    expect(screen.getByText("User-provided licensed import")).toBeInTheDocument();
    expect(screen.getByText(/not diagnostic evidence/i)).toBeInTheDocument();
    expect(screen.getByText("Synthetic value")).toBeInTheDocument();
  });

  it("renders admin import warnings and does not store admin secrets", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { imports: [] },
          warnings: [],
          meta: { requestId: "fixture", timestamp: "2026-06-29T00:00:00.000Z" },
        }),
      ),
    );
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");

    render(<GeneCardsImportPanel />);
    expect(
      screen.getByText(/Do not scrape, crawl, fetch, or paste GeneCards web pages/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload licensed import/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/admin bearer secret/i), {
      target: { value: "test-admin-secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /list recent imports/i }));

    expect(storageSpy).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/admin/genecards/imports",
      expect.objectContaining({
        headers: { Authorization: "Bearer test-admin-secret" },
      }),
    );

    fetchSpy.mockRestore();
    storageSpy.mockRestore();
  });
});
