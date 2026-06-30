import type { PublicRankedGene, RankingMode } from "@/lib/ranking/types";

export const EXPORT_DISCLAIMER =
  "Research and educational use only. Not medical advice. Not a diagnosis. Results require review by qualified genetics professionals. Prioritization scores are not clinical probabilities.";

export type ExportHpoTerm = {
  hpoId: string;
  label?: string | null;
};

export type ExportCandidateGene = {
  input?: string;
  symbol?: string | null;
  canonicalSymbol?: string | null;
  status?: string;
  validationStatus?: string;
  warnings?: string[];
};

export type ReportExportInput = {
  timestamp?: string;
  appVersion?: string;
  includeRawText?: boolean;
  rawText?: string;
  inputSummary: {
    inputMode: "free_text" | "hpo_codes" | "mixed";
    rawTextIncluded?: boolean;
    hpoTermCount: number;
    candidateGeneCount: number;
  };
  confirmedHpoTerms: ExportHpoTerm[];
  candidateGenes: ExportCandidateGene[];
  rankingMode: RankingMode;
  algorithmVersion: string;
  dataSourceVersions: Record<string, unknown>;
  rankedResults: PublicRankedGene[];
  warnings: string[];
  literatureIncluded: boolean;
  disclaimer?: string;
};

export type JsonReport = ReportExportInput & {
  generatedAt: string;
  disclaimer: string;
};
