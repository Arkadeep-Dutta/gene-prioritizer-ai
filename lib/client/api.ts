import type {
  ApiEnvelope,
  ClientApiError,
  DataVersionData,
  GeneValidationData,
  HealthData,
  HpoTermLookupData,
  PrioritizeRequest,
} from "./types";
import type { PhenotypeExtractionResult } from "@/lib/phenotype/types";
import type { RankingResponseData } from "@/lib/ranking/types";

function toClientApiError(
  message: string,
  code = "CLIENT_API_ERROR",
  status = 0,
  warnings: string[] = [],
): ClientApiError {
  return Object.assign(new Error(message), { code, status, warnings });
}

async function parseJson<TData>(response: Response): Promise<ApiEnvelope<TData>> {
  try {
    return (await response.json()) as ApiEnvelope<TData>;
  } catch {
    throw toClientApiError("The server returned an unreadable response.", "INVALID_JSON", 502);
  }
}

export async function requestJson<TData>(
  path: string,
  init?: RequestInit,
): Promise<ApiEnvelope<TData>> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw toClientApiError("Network request failed. Please try again.", "NETWORK_ERROR", 0);
  }

  const envelope = await parseJson<TData>(response);
  if (!response.ok || !envelope.ok) {
    throw toClientApiError(
      envelope.error?.message ?? "The request could not be completed.",
      envelope.error?.code ?? "API_ERROR",
      response.status,
      envelope.warnings ?? [],
    );
  }
  return envelope;
}

export async function extractPhenotypes(text: string, useLLM = false) {
  return requestJson<PhenotypeExtractionResult>("/api/phenotype/extract", {
    method: "POST",
    body: JSON.stringify({ text, useLLM }),
  });
}

export async function validateGenes(genes: string[]) {
  return requestJson<GeneValidationData>("/api/genes/validate", {
    method: "POST",
    body: JSON.stringify({ genes }),
  });
}

export async function getHpoTerm(hpoId: string) {
  return requestJson<HpoTermLookupData>(`/api/hpo/term/${encodeURIComponent(hpoId)}`);
}

export async function prioritizeGenes(request: PrioritizeRequest) {
  return requestJson<RankingResponseData>("/api/prioritize", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function getHealth() {
  return requestJson<HealthData>("/api/health");
}

export async function getDataVersions() {
  return requestJson<DataVersionData>("/api/data/version");
}
