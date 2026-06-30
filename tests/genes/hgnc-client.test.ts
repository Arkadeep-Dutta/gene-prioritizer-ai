import { describe, expect, it, vi } from "vitest";

import { resolveHgncSymbol } from "@/lib/genes/hgnc-client";

function hgncResponse(docs: unknown[]) {
  return new Response(JSON.stringify({ response: { numFound: docs.length, docs } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const scn2aDoc = {
  symbol: "SCN2A",
  hgnc_id: "HGNC:10588",
  name: "sodium voltage-gated channel alpha subunit 2",
  alias_symbol: ["NAC2"],
  prev_symbol: ["SCN2AOLD"],
  ensembl_gene_id: "ENSG00000136531",
  entrez_id: "6326",
  status: "Approved",
};

describe("HGNC client", () => {
  it("resolves exact approved symbols", async () => {
    const fetchFn = vi.fn().mockResolvedValue(hgncResponse([scn2aDoc]));

    const result = await resolveHgncSymbol("SCN2A", { fetchFn, retries: 0 });

    expect(result).toMatchObject({
      status: "VALIDATED",
      canonicalSymbol: "SCN2A",
      hgncId: "HGNC:10588",
      matchedField: "symbol",
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("resolves previous symbols after exact lookup misses", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(hgncResponse([]))
      .mockResolvedValueOnce(hgncResponse([scn2aDoc]));

    const result = await resolveHgncSymbol("SCN2AOLD", { fetchFn, retries: 0 });

    expect(result.status).toBe("PREVIOUS_SYMBOL_RESOLVED");
    expect(result.canonicalSymbol).toBe("SCN2A");
    expect(result.matchedField).toBe("prev_symbol");
  });

  it("resolves aliases after exact and previous lookup miss", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(hgncResponse([]))
      .mockResolvedValueOnce(hgncResponse([]))
      .mockResolvedValueOnce(hgncResponse([scn2aDoc]));

    const result = await resolveHgncSymbol("NAC2", { fetchFn, retries: 0 });

    expect(result.status).toBe("ALIAS_RESOLVED");
    expect(result.canonicalSymbol).toBe("SCN2A");
    expect(result.matchedField).toBe("alias_symbol");
  });

  it("returns invalid for clean no-match responses", async () => {
    const fetchFn = vi.fn().mockImplementation(() => Promise.resolve(hgncResponse([])));

    const result = await resolveHgncSymbol("NOTREAL4", { fetchFn, retries: 0 });

    expect(result.status).toBe("INVALID");
    expect(result.canonicalSymbol).toBeNull();
  });

  it("returns unvalidated when HGNC is unavailable and retries safely", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("network down"));

    const result = await resolveHgncSymbol("SCN2A", { fetchFn, retries: 1 });

    expect(result.status).toBe("UNVALIDATED");
    expect(result.canonicalSymbol).toBe("SCN2A");
    expect(result.warnings.join(" ")).toContain("not confirmed");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("handles malformed HGNC responses safely", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({ unexpected: true })));

    const result = await resolveHgncSymbol("SCN2A", { fetchFn, retries: 0 });

    expect(result.status).toBe("UNVALIDATED");
    expect(result.warnings.join(" ")).toContain("unexpected response");
  });
});
