import { getNcbiConfig } from "./config";
import { LiteratureError } from "./errors";
import { parsePubMedFetchXml, parsePubMedSummary } from "./pubmed-parser";
import { waitForRateLimit } from "./rate-limit";
import type { NcbiClientConfig, PubMedArticle } from "./types";

export type NcbiFetch = typeof fetch;

export class NcbiClient {
  constructor(
    private readonly config: NcbiClientConfig = getNcbiConfig(),
    private readonly fetcher: NcbiFetch = fetch,
  ) {}

  private async request(path: string, params: Record<string, string>): Promise<Response> {
    const url = new URL(`${this.config.baseUrl.replace(/\/$/, "")}/${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
    if (this.config.apiKey) url.searchParams.set("api_key", this.config.apiKey);
    if (this.config.email) url.searchParams.set("email", this.config.email);
    if (this.config.tool) url.searchParams.set("tool", this.config.tool);

    const rps = this.config.apiKey
      ? this.config.rateLimitRpsWithKey
      : this.config.rateLimitRpsNoKey;
    await waitForRateLimit(this.config.baseUrl, rps);

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.config.retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
      try {
        const response = await this.fetcher(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (response.status === 429) {
          lastError = new LiteratureError("NCBI rate limit response.", "NCBI_RATE_LIMIT", 503);
        } else if (response.status >= 500) {
          lastError = new LiteratureError("NCBI service unavailable.", "NCBI_UNAVAILABLE", 503);
        } else if (!response.ok) {
          throw new LiteratureError("NCBI request failed.", "NCBI_REQUEST_FAILED", 502);
        } else {
          return response;
        }
      } catch (error) {
        clearTimeout(timeout);
        lastError =
          error instanceof LiteratureError
            ? error
            : new LiteratureError("NCBI request failed.", "NCBI_NETWORK_FAILURE", 503);
      }
    }
    throw lastError instanceof LiteratureError
      ? lastError
      : new LiteratureError("NCBI request failed.", "NCBI_REQUEST_FAILED", 503);
  }

  async searchPubMedIds(query: string, retmax: number): Promise<string[]> {
    const response = await this.request("esearch.fcgi", {
      db: "pubmed",
      retmode: "json",
      retmax: String(retmax),
      term: query,
    });
    const json = (await response.json()) as { esearchresult?: { idlist?: unknown } };
    const ids = json.esearchresult?.idlist;
    if (!Array.isArray(ids)) {
      throw new LiteratureError(
        "Malformed PubMed search response.",
        "NCBI_MALFORMED_RESPONSE",
        502,
      );
    }
    return Array.from(new Set(ids.map(String).filter(Boolean)));
  }

  async fetchPubMedSummaries(pmids: string[]): Promise<PubMedArticle[]> {
    const unique = Array.from(new Set(pmids)).filter(Boolean);
    if (unique.length === 0) return [];
    const response = await this.request("esummary.fcgi", {
      db: "pubmed",
      retmode: "json",
      id: unique.join(","),
    });
    const json = (await response.json()) as {
      result?: Record<string, unknown> & { uids?: string[] };
    };
    const uids = json.result?.uids;
    if (!Array.isArray(uids) || !json.result) {
      throw new LiteratureError(
        "Malformed PubMed summary response.",
        "NCBI_MALFORMED_RESPONSE",
        502,
      );
    }
    return uids.map((uid) => parsePubMedSummary(json.result![uid]));
  }

  async fetchPubMedDetails(pmids: string[]): Promise<PubMedArticle[]> {
    const unique = Array.from(new Set(pmids)).filter(Boolean);
    if (unique.length === 0) return [];
    const response = await this.request("efetch.fcgi", {
      db: "pubmed",
      retmode: "xml",
      id: unique.join(","),
    });
    return parsePubMedFetchXml(await response.text());
  }
}
