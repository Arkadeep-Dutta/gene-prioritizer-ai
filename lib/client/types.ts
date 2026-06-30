import type { GeneValidationResult, GeneValidationSummary } from "@/lib/genes/types";
import type { PhenotypeExtractionResult } from "@/lib/phenotype/types";
import type { RankingMode, RankingResponseData } from "@/lib/ranking/types";

export type ApiEnvelope<TData> = {
  ok: boolean;
  data: TData;
  warnings: string[];
  meta?: {
    requestId: string;
    timestamp: string;
  };
  error?: {
    code: string;
    message: string;
  };
};

export type ClientApiError = Error & {
  code: string;
  status: number;
  warnings: string[];
};

export type GeneValidationData = {
  results: GeneValidationResult[];
  summary: GeneValidationSummary | null;
};

export type PrioritizeRequest = {
  hpoTerms: string[];
  candidateGenes?: string[];
  rankingMode: RankingMode;
  limit: number;
  storeResults: boolean;
  privacyMode: boolean;
  includeLiterature: boolean;
  literatureRetmax: number;
  literatureSummaries: boolean;
  metadata?: Record<string, string | number | boolean | null>;
};

export type HealthData = {
  status: string;
  data: {
    counts: {
      hpoTerms: number;
      genes: number;
      validatedGenes: number;
      unvalidatedGenes: number;
      genePhenotypeAssociations: number;
      rankingResults: number;
      literatureRecords: number;
    };
    sources: Array<{ sourceName: string; version: string | null; importedAt: string | Date }>;
  };
  ranking: { algorithmVersion: string; available: boolean };
  phenotypeExtraction: { available: boolean; maxTextChars: number; externalLlmAllowed: boolean };
  literature: { enabled: boolean; recordCount: number; maxRetmax: number };
};

export type DataVersionData = {
  phenotypeExtraction: Record<string, unknown>;
  ranking: { algorithmVersion?: string };
  literature: Record<string, unknown>;
  imported: Record<string, boolean>;
  sources: Array<{
    sourceName: string;
    sourceType: string;
    version: string | null;
    importedAt: string | Date;
  }>;
};

export type ExtractPhenotypeResponse = ApiEnvelope<PhenotypeExtractionResult>;
export type GeneValidationResponse = ApiEnvelope<GeneValidationData>;
export type PrioritizeResponse = ApiEnvelope<RankingResponseData>;
export type HealthResponse = ApiEnvelope<HealthData>;
export type DataVersionResponse = ApiEnvelope<DataVersionData>;
