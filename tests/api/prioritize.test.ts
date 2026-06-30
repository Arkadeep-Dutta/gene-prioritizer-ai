import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/prioritize/route";
import { prisma } from "@/lib/db/prisma";

afterEach(async () => {
  vi.restoreAllMocks();
  await prisma.userCase.deleteMany({ where: { inputType: "HPO_RANKING" } });
});

function postJson(body: unknown) {
  return POST(
    new Request("http://localhost/api/prioritize", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("POST /api/prioritize", () => {
  it("works with HPO terms only and includes transparent evidence", async () => {
    const response = await postJson({ hpoTerms: ["HP:0001250"], storeResults: false });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.results.length).toBeGreaterThan(0);
    expect(body.data.results[0].scoreBreakdown).toMatchObject({
      exactHpoMatch: expect.any(Number),
      literatureBoost: 0,
    });
    expect(body.data.results[0].matchedPhenotypes.length).toBeGreaterThan(0);
    expect(body.data.disclaimer).toContain("not a diagnosis");
  });

  it("works with candidate genes in candidate-only and boosted modes", async () => {
    const candidateOnly = await postJson({
      hpoTerms: ["HP:0001250"],
      candidateGenes: ["SCN2A", "MYH7"],
      rankingMode: "CANDIDATE_ONLY",
      storeResults: false,
    });
    const boosted = await postJson({
      hpoTerms: ["HP:0001250"],
      candidateGenes: ["SCN2A"],
      rankingMode: "CANDIDATE_BOOSTED",
      storeResults: false,
    });
    const candidateBody = await candidateOnly.json();
    const boostedBody = await boosted.json();

    expect(candidateOnly.status).toBe(200);
    expect(
      candidateBody.data.results
        .map((result: { gene: { symbol: string } }) => result.gene.symbol)
        .sort(),
    ).toEqual(["MYH7", "SCN2A"]);
    expect(boostedBody.data.results[0].scoreBreakdown.candidateBoost).toBeGreaterThanOrEqual(0);
  });

  it("returns structured errors for invalid and unknown HPO terms", async () => {
    const invalid = await postJson({ hpoTerms: ["HP:1250"] });
    const unknown = await postJson({ hpoTerms: ["HP:9999999"] });

    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ ok: false, error: { code: "HPO_ID_INVALID" } });
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toMatchObject({
      ok: false,
      error: { code: "HPO_TERM_NOT_FOUND" },
    });
  });

  it("handles invalid candidates and no matches safely without leaking secrets or stack traces", async () => {
    const response = await postJson({
      hpoTerms: ["HP:0001627"],
      candidateGenes: ["BAD<script>"],
      rankingMode: "CANDIDATE_BOOSTED",
      storeResults: false,
    });
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(serialized).toContain("Invalid candidate gene symbol");
    expect(serialized).not.toContain("DATABASE_URL");
    expect(serialized).not.toContain(process.env.DATABASE_URL);
    expect(serialized).not.toContain("Error:");
    expect(serialized).not.toContain(" at ");
  });

  it("rejects raw freeText and does not call external network for ranking", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await postJson({ hpoTerms: ["HP:0001250"], freeText: "patient has seizures" });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("PRIORITIZE_REQUEST_INVALID");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("stores privacy-safe results when requested", async () => {
    const response = await postJson({
      hpoTerms: ["HP:0001250"],
      candidateGenes: ["SCN2A"],
      storeResults: true,
    });
    const body = await response.json();
    const userCase = await prisma.userCase.findUnique({
      where: { inputHash: body.data.inputHash },
    });

    expect(body.data.caseId).toBeTruthy();
    expect(userCase?.rawTextStored).toBe(false);
    expect(JSON.stringify(body)).not.toContain("diagnostic probability");
    expect(JSON.stringify(body)).not.toContain("geneCards scraping");
  });
});
