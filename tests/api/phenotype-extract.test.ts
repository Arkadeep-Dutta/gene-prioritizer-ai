import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/phenotype/extract/route";
import { prisma } from "@/lib/db/prisma";

afterEach(() => {
  vi.restoreAllMocks();
});

function postJson(body: unknown) {
  return POST(
    new Request("http://localhost/api/phenotype/extract", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("POST /api/phenotype/extract", () => {
  it("extracts deterministic present, negated, uncertain, and family-history terms", async () => {
    const response = await postJson({
      text: "Infant with seizures, suspected hypotonia, and feeding difficulty. No microcephaly. Family history of cardiomyopathy in the father.",
      useLLM: false,
      maxTerms: 50,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.terms).toEqual(
      expect.arrayContaining([expect.objectContaining({ hpoId: "HP:0001250" })]),
    );
    expect(body.data.negatedTerms).toEqual(
      expect.arrayContaining([expect.objectContaining({ hpoId: "HP:0000252" })]),
    );
    expect(body.data.uncertainTerms).toEqual(
      expect.arrayContaining([expect.objectContaining({ hpoId: "HP:0001252" })]),
    );
    expect(body.data.familyHistoryTerms).toEqual(
      expect.arrayContaining([expect.objectContaining({ hpoId: "HP:0001638" })]),
    );
    expect(body.data.confirmedHpoTermsForRanking).toContain("HP:0001250");
    expect(body.data.confirmedHpoTermsForRanking).not.toContain("HP:0000252");
    expect(body.data.requiresConfirmation).toBe(true);
    expect(body.data.disclaimer).toContain("not a diagnosis");
  });

  it("falls back when LLM is requested but disabled", async () => {
    const response = await postJson({ text: "Seizures.", useLLM: true });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.method).toBe("deterministic");
    expect(body.data.warnings.join(" ")).toContain("DISABLE_LLM=true");
  });

  it("returns structured validation errors", async () => {
    const empty = await postJson({ text: "" });
    const invalid = await postJson({ text: "seizures", file: "not allowed" });

    expect(empty.status).toBe(400);
    expect(await empty.json()).toMatchObject({
      ok: false,
      error: { code: "PHENOTYPE_TEXT_REQUIRED" },
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({
      ok: false,
      error: { code: "PHENOTYPE_EXTRACT_REQUEST_INVALID" },
    });
  });

  it("handles no phenotype found without leaking secrets or stack traces", async () => {
    const response = await postJson({ text: "Enjoys music and school.", useLLM: false });
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.data.terms).toEqual([]);
    expect(body.data.warnings.join(" ")).toContain("No local HPO phenotype terms");
    expect(serialized).not.toContain("DATABASE_URL");
    expect(serialized).not.toContain(process.env.DATABASE_URL);
    expect(serialized).not.toContain("Error:");
    expect(serialized).not.toContain(" at ");
  });

  it("does not store raw clinical text or call external network in deterministic mode", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const beforeCases = await prisma.userCase.count();
    const response = await postJson({ text: "Synthetic example with seizures.", useLLM: false });
    const afterCases = await prisma.userCase.count();
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(afterCases).toBe(beforeCases);
    expect(serialized).not.toContain("diagnosis probability");
    expect(serialized).not.toContain("PubMed");
    expect(serialized).not.toContain("GeneCards");
  });
});
