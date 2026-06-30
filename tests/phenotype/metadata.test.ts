import { describe, expect, it } from "vitest";

import { extractPhenotypeMetadata } from "@/lib/phenotype/metadata";

describe("phenotype metadata extraction", () => {
  it("detects lightweight onset, sex, and inheritance clues", () => {
    expect(extractPhenotypeMetadata("Infant boy with seizures")).toMatchObject({
      ageOfOnset: "infantile",
      sex: "male",
    });
    expect(extractPhenotypeMetadata("Congenital symptoms in a female")).toMatchObject({
      ageOfOnset: "congenital",
      sex: "female",
    });
    expect(extractPhenotypeMetadata("Autosomal recessive condition suspected")).toMatchObject({
      inheritancePattern: "autosomal recessive",
    });
  });

  it("flags weak family clues without overstating certainty", () => {
    const metadata = extractPhenotypeMetadata("Parents report consanguinity.");

    expect(metadata.inheritancePattern).toBe("consanguinity reported");
    expect(metadata.warnings.length).toBeGreaterThan(0);
  });
});
