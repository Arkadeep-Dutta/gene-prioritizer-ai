import type { GeneLinkouts, GeneValidationStatus } from "@/lib/genes/types";
import type { LicensedGeneCardsAnnotation } from "@/lib/genecards/types";
import type { LiteratureEvidenceForGene } from "@/lib/literature/types";

export const RANKING_MODES = [
  "ALL_GENES",
  "CANDIDATE_ONLY",
  "CANDIDATE_BOOSTED",
  "DISCOVERY",
] as const;

export type RankingMode = (typeof RANKING_MODES)[number];

export type SafeRankingMetadata = Record<string, string | number | boolean | null>;

export type ConfirmedHpoTerm = {
  hpoId: string;
  label: string;
  isObsolete: boolean;
};

export type NormalizedCandidateGene = {
  input: string;
  normalizedInput: string | null;
  symbol: string | null;
  name: string | null;
  hgncId: string | null;
  entrezId: string | null;
  ncbiGeneId: string | null;
  ensemblId: string | null;
  validationStatus: GeneValidationStatus;
  isValidated: boolean;
  geneId: string | null;
  links: GeneLinkouts | null;
  warnings: string[];
};

export type NormalizedRankingInput = {
  hpoTerms: ConfirmedHpoTerm[];
  candidateGenes: NormalizedCandidateGene[];
  rankingMode: RankingMode;
  limit: number;
  storeResults: boolean;
  privacyMode: boolean;
  includeLiterature: boolean;
  literatureRetmax: number;
  literatureSummaries: boolean;
  metadata: SafeRankingMetadata;
  warnings: string[];
  algorithmVersion: string;
};

export type AssociationEvidence = {
  evidenceSource: string | null;
  evidenceCode: string | null;
  diseaseId: string | null;
  diseaseName: string | null;
  frequency: string | null;
  onset: string | null;
  reference: string | null;
};

export type GenePhenotypeForRanking = {
  geneId: string;
  symbol: string;
  name: string | null;
  hgncId: string | null;
  entrezId: string | null;
  ncbiGeneId: string | null;
  ensemblId: string | null;
  validationStatus: GeneValidationStatus;
  isValidated: boolean;
  phenotype: ConfirmedHpoTerm;
  evidence: AssociationEvidence;
};

export type MatchType = "EXACT" | "ANCESTOR" | "DESCENDANT" | "RELATED" | "NO_MATCH";

export type MatchedPhenotype = {
  inputHpoId: string;
  inputLabel: string;
  matchedHpoId: string;
  matchedLabel: string;
  matchType: MatchType;
  matchDepth: number;
  associationEvidence: AssociationEvidence;
};

export type ScoreBreakdown = {
  exactHpoMatch: number;
  ancestorHpoMatch: number;
  specificityWeight: number;
  evidenceWeight: number;
  candidateBoost: number;
  literatureBoost: number;
  penalties: number;
};

export type RankedGene = {
  rank: number;
  gene: {
    symbol: string;
    name: string | null;
    validationStatus: GeneValidationStatus;
    hgncId: string | null;
    links: GeneLinkouts | null;
    licensedGeneCardsAnnotations?: LicensedGeneCardsAnnotation[];
  };
  score: number;
  scoreLabel: string;
  scoreBreakdown: ScoreBreakdown;
  matchedPhenotypes: MatchedPhenotype[];
  warnings: string[];
  explanation: string;
  isCandidateGene: boolean;
  geneId: string | null;
  literatureEvidence?: LiteratureEvidenceForGene;
};

export type PublicCandidateGene = Omit<NormalizedCandidateGene, "geneId">;

export type PublicRankedGene = Omit<RankedGene, "geneId">;

export type RankingResponseData = {
  caseId?: string;
  inputHash: string;
  algorithmVersion: string;
  rankingMode: RankingMode;
  confirmedHpoTerms: ConfirmedHpoTerm[];
  candidateGenes: PublicCandidateGene[];
  results: PublicRankedGene[];
  dataVersions: Record<string, unknown>;
  warnings: string[];
  literatureWarnings?: string[];
  disclaimer: string;
};
