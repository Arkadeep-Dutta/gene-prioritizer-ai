import documentsRegistry from "../../legal/registry/documents.json";
import clausesRegistry from "../../legal/registry/clauses.json";
import reviewsRegistry from "../../legal/registry/reviews.json";
import agreementsRegistry from "../../legal/registry/agreements.json";
import insuranceRegistry from "../../legal/registry/insurance-readiness.json";
import legalFixtures from "../../legal/fixtures/synthetic/legal-fixtures.json";
import type { LegalClause, LegalDocument, LegalReview } from "./types";

export function getLegalDocuments(): LegalDocument[] {
  return documentsRegistry.documents as LegalDocument[];
}

export function getLegalClauses(): LegalClause[] {
  return clausesRegistry.clauses as LegalClause[];
}

export function getLegalReviews(): LegalReview[] {
  return reviewsRegistry.reviews as LegalReview[];
}

export function getAgreementRegistry() {
  return agreementsRegistry;
}

export function getInsuranceReadinessRegistry() {
  return insuranceRegistry;
}

export function getSyntheticLegalFixtures() {
  return legalFixtures;
}

export function getLegalDocumentById(id: string): LegalDocument | undefined {
  return getLegalDocuments().find((document) => document.id === id);
}
