import type { PhenotypeMetadata } from "./types";

export function extractPhenotypeMetadata(text: string): PhenotypeMetadata {
  const lower = text.toLowerCase();
  const warnings: string[] = [];

  let ageOfOnset: string | null = null;
  if (/\bneonatal\b/.test(lower)) ageOfOnset = "neonatal";
  else if (/\binfantile\b|\binfant\b/.test(lower)) ageOfOnset = "infantile";
  else if (/\bcongenital\b/.test(lower)) ageOfOnset = "congenital";
  else if (/\bprenatal\b/.test(lower)) ageOfOnset = "prenatal";
  else if (/\bchildhood\b|\bchild\b/.test(lower)) ageOfOnset = "childhood";
  else if (/\badult onset\b/.test(lower)) ageOfOnset = "adult onset";
  else if (/\bearly onset\b/.test(lower)) ageOfOnset = "early onset";

  let sex: string | null = null;
  if (/\bmale\b|\bboy\b/.test(lower)) sex = "male";
  else if (/\bfemale\b|\bgirl\b/.test(lower)) sex = "female";

  let inheritancePattern: string | null = null;
  if (/\bautosomal dominant\b/.test(lower)) inheritancePattern = "autosomal dominant";
  else if (/\bautosomal recessive\b/.test(lower)) inheritancePattern = "autosomal recessive";
  else if (/\bx-linked\b|\bx linked\b/.test(lower)) inheritancePattern = "X-linked";
  else if (/\bde novo\b/.test(lower)) inheritancePattern = "de novo";
  else if (/\bconsanguinity\b|\bconsanguineous\b/.test(lower)) {
    inheritancePattern = "consanguinity reported";
    warnings.push("Inheritance clue is a text cue only and requires review.");
  } else if (/\baffected sibling\b|\bsibling affected\b/.test(lower)) {
    inheritancePattern = "affected sibling reported";
    warnings.push("Family-history clue is a text cue only and requires review.");
  }

  return { ageOfOnset, sex, inheritancePattern, warnings };
}
