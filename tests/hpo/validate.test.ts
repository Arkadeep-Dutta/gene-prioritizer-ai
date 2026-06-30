import { describe, expect, it } from "vitest";

import { assertValidHpoId, isValidHpoId, normalizeHpoId } from "@/lib/hpo/validate";

describe("HPO ID validation", () => {
  it("accepts canonical HPO IDs", () => {
    expect(isValidHpoId("HP:0001250")).toBe(true);
    expect(assertValidHpoId("HP:0001250")).toBe("HP:0001250");
  });

  it("trims whitespace", () => {
    expect(normalizeHpoId("  HP:0001250  ")).toBe("HP:0001250");
  });

  it("rejects malformed IDs", () => {
    expect(isValidHpoId("HP:1250")).toBe(false);
    expect(isValidHpoId("hp:0001250")).toBe(false);
    expect(isValidHpoId("HP:ABCDEF")).toBe(false);
    expect(isValidHpoId("")).toBe(false);
    expect(() => assertValidHpoId("HP:1250")).toThrow("Invalid HPO ID");
  });
});
