export const LOGRES_BRAND = {
  platformId: "logres",
  platformDisplayName: "Logres",
  platformPublicName: "Logres Genomic Platform",
  primaryProductId: "genemed",
  primaryProductDisplayName: "Genemed",
  productRelationship: "Genemed by Logres",
  productCategory: "phenotype_to_gene_research",
  clinicalUseStatus: "blocked",
  researchUseDisclaimer:
    "Research and education only. Not for diagnosis, treatment, clinical decision-making, or submission of identifiable patient data.",
  prohibitedPublicClaims: [
    "clinical-grade",
    "clinically proven",
    "causal-gene finder",
    "diagnostic ai",
    "medical diagnosis platform",
  ],
} as const;

export type PlatformId = typeof LOGRES_BRAND.platformId;
export type ProductId = typeof LOGRES_BRAND.primaryProductId;
