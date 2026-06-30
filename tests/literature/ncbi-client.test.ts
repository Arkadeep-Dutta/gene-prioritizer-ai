import { beforeEach, describe, expect, it, vi } from "vitest";

import esearchFixture from "@/tests/fixtures/pubmed/esearch-gene-phenotype.json";
import esummaryFixture from "@/tests/fixtures/pubmed/esummary.json";
import noResultsFixture from "@/tests/fixtures/pubmed/no-results.json";
import { NcbiClient } from "@/lib/literature/ncbi-client";
import { resetRateLimitState } from "@/lib/literature/rate-limit";

const baseConfig = {
  baseUrl: "https://example.test/eutils",
  apiKey: "",
  email: "",
  tool: "",
  timeoutMs: 1000,
  retries: 0,
  rateLimitRpsNoKey: 10_000,
  rateLimitRpsWithKey: 10_000,
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("NCBI E-utilities client", () => {
  beforeEach(() => {
    resetRateLimitState();
    vi.restoreAllMocks();
  });

  it("searches PubMed IDs successfully and deduplicates PMIDs", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        esearchresult: { idlist: ["12345678", "12345678", "23456789"] },
      }),
    );
    const client = new NcbiClient(baseConfig, fetcher);

    await expect(client.searchPubMedIds('"SCN2A"[Title/Abstract]', 5)).resolves.toEqual([
      "12345678",
      "23456789",
    ]);
  });

  it("handles no PubMed search results", async () => {
    const client = new NcbiClient(
      baseConfig,
      vi.fn().mockResolvedValue(jsonResponse(noResultsFixture)),
    );

    await expect(client.searchPubMedIds("empty", 5)).resolves.toEqual([]);
  });

  it("rejects malformed search responses", async () => {
    const client = new NcbiClient(baseConfig, vi.fn().mockResolvedValue(jsonResponse({})));

    await expect(client.searchPubMedIds("bad", 5)).rejects.toMatchObject({
      code: "NCBI_MALFORMED_RESPONSE",
    });
  });

  it("fetches PubMed summaries", async () => {
    const client = new NcbiClient(
      baseConfig,
      vi.fn().mockResolvedValue(jsonResponse(esummaryFixture)),
    );

    const summaries = await client.fetchPubMedSummaries(["12345678", "23456789"]);

    expect(summaries).toHaveLength(2);
    expect(summaries[0].pmid).toBe("12345678");
  });

  it("fetches PubMed XML details", async () => {
    const xml = `<?xml version="1.0"?><PubmedArticleSet><PubmedArticle><MedlineCitation><PMID>12345678</PMID><Article><ArticleTitle>Title</ArticleTitle></Article></MedlineCitation></PubmedArticle></PubmedArticleSet>`;
    const client = new NcbiClient(
      baseConfig,
      vi.fn().mockResolvedValue(new Response(xml, { status: 200 })),
    );

    const details = await client.fetchPubMedDetails(["12345678"]);

    expect(details[0].pmid).toBe("12345678");
  });

  it("adds API key, email, and tool only when configured", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(esearchFixture));
    const client = new NcbiClient(
      {
        ...baseConfig,
        apiKey: "secret-key",
        email: "ops@example.test",
        tool: "gene-prioritizer-ai",
      },
      fetcher,
    );

    await client.searchPubMedIds("query", 1);
    const requestedUrl = fetcher.mock.calls[0][0] as URL;

    expect(requestedUrl.searchParams.get("api_key")).toBe("secret-key");
    expect(requestedUrl.searchParams.get("email")).toBe("ops@example.test");
    expect(requestedUrl.searchParams.get("tool")).toBe("gene-prioritizer-ai");
  });

  it("retries 5xx responses and hides secrets from errors", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(jsonResponse(esearchFixture));
    const client = new NcbiClient({ ...baseConfig, apiKey: "secret-key", retries: 1 }, fetcher);

    await expect(client.searchPubMedIds("query", 2)).resolves.toEqual(["12345678", "23456789"]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("maps 429 and network failures to structured errors without secret values", async () => {
    const rateLimited = new NcbiClient(
      { ...baseConfig, apiKey: "secret-key" },
      vi.fn().mockResolvedValue(new Response("too many", { status: 429 })),
    );
    const networkFailed = new NcbiClient(
      { ...baseConfig, apiKey: "secret-key" },
      vi.fn().mockRejectedValue(new Error("network")),
    );

    await expect(rateLimited.searchPubMedIds("query", 2)).rejects.toMatchObject({
      code: "NCBI_RATE_LIMIT",
    });
    await expect(networkFailed.searchPubMedIds("query", 2)).rejects.toMatchObject({
      code: "NCBI_NETWORK_FAILURE",
    });
  });
});
