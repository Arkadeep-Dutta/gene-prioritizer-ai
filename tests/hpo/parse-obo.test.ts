import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parseOboText } from "@/lib/hpo/parse-obo";

const fixturePath = resolve(process.cwd(), "tests/fixtures/hpo/hp.fixture.obo");

describe("parseOboText", () => {
  it("extracts terms, definitions, synonyms, relationships, alt IDs, and obsolete metadata", async () => {
    const parsed = parseOboText(await readFile(fixturePath, "utf8"));
    const seizure = parsed.terms.find((term) => term.hpoId === "HP:0001250");
    const obsolete = parsed.terms.find((term) => term.hpoId === "HP:0009999");

    expect(seizure).toMatchObject({
      hpoId: "HP:0001250",
      label: "Seizure",
      isObsolete: false,
      altIds: ["HP:9999999"],
      parents: ["HP:0012638"],
    });
    expect(seizure?.definition).toContain("seizure");
    expect(seizure?.synonyms.map((synonym) => synonym.value)).toContain("Seizures");
    expect(obsolete).toMatchObject({
      isObsolete: true,
      replacedBy: "HP:0001250",
    });
    expect(parsed.relationships).toContainEqual({
      parentHpoId: "HP:0012638",
      childHpoId: "HP:0001250",
      relationshipType: "is_a",
    });
  });
});
