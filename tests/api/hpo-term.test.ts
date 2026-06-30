import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/hpo/term/[id]/route";

describe("GET /api/hpo/term/[id]", () => {
  it("returns local term details and handles URL-encoded colons", async () => {
    const response = await GET(new Request("http://localhost/api/hpo/term/HP%3A0001250"), {
      params: Promise.resolve({ id: "HP%3A0001250" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toMatchObject({
      hpoId: "HP:0001250",
      label: "Seizure",
      associatedGenesCount: expect.any(Number),
    });
    expect(body.data.synonyms).toEqual(expect.arrayContaining(["Seizures"]));
    expect(body.data.parents).toEqual(
      expect.arrayContaining([expect.objectContaining({ hpoId: "HP:0012638" })]),
    );
  });

  it("returns a safe 404-style envelope for unknown terms", async () => {
    const response = await GET(new Request("http://localhost/api/hpo/term/HP%3A7777777"), {
      params: Promise.resolve({ id: "HP%3A7777777" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toMatchObject({
      ok: false,
      error: { code: "HPO_TERM_NOT_FOUND" },
    });
  });
});
