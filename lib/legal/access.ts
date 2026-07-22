import { getAgreementRegistry, getSyntheticLegalFixtures } from "./registry";

export type LegalReleaseDecision = { allowed: boolean; blockers: string[] };

export function canEnableGenemedEntitlement(params: {
  organizationId: string;
  releaseTarget: string;
  commercial: boolean;
}): LegalReleaseDecision {
  const blockers: string[] = [];
  const requirements = getAgreementRegistry().agreement_requirements.find(
    (item) => item.release_target === params.releaseTarget,
  );
  if (!requirements) blockers.push(`Unknown release target: ${params.releaseTarget}`);
  if (requirements && "blocked" in requirements && requirements.blocked)
    blockers.push("Clinical-use release is blocked");
  if (params.commercial && params.releaseTarget !== "commercial_research")
    blockers.push("Commercial entitlement requires commercial_research release target");
  if (params.commercial) {
    const agreements = getAgreementRegistry().synthetic_agreements.filter(
      (item) => item.organization_id === params.organizationId,
    );
    if (!agreements.some((item) => item.status === "executed_external_evidence_required"))
      blockers.push(
        "Commercial entitlement blocked until external executed agreement evidence is recorded outside Git",
      );
  }
  if (params.releaseTarget === "synthetic_demo") {
    const fixture = getSyntheticLegalFixtures().onboarding_cases.find(
      (item) => item.organization_id === params.organizationId,
    );
    if (!fixture) blockers.push("Synthetic onboarding fixture missing");
  }
  return { allowed: blockers.length === 0, blockers };
}
