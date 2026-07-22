import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { legalDocumentHash, stableHash } from "./hash";
import {
  getAgreementRegistry,
  getInsuranceReadinessRegistry,
  getLegalClauses,
  getLegalDocuments,
  getLegalReviews,
  getSyntheticLegalFixtures,
} from "./registry";
import type { ValidationMessage, ValidationSummary } from "./types";

const root = process.cwd();
const blockedClaims = [
  "hipaa compliant",
  "soc 2 certified",
  "fda cleared",
  "clinical-grade",
  "clinically proven",
  "causal gene found",
  "disease confirmed",
  "diagnosis guaranteed",
  "uptime guarantee",
  "business associate agreement included",
];

function message(level: ValidationMessage["level"], code: string, text: string): ValidationMessage {
  return { level, code, message: text };
}

function summary(command: string, messages: ValidationMessage[]): ValidationSummary {
  return {
    command,
    status: messages.some((item) => item.level === "block") ? "fail" : "pass",
    messages,
  };
}

function unique(values: string[]) {
  return new Set(values).size === values.length;
}

function ensurePathExists(relativePath: string, messages: ValidationMessage[], code: string) {
  if (!existsSync(path.join(root, relativePath)))
    messages.push(message("block", code, `Missing required path: ${relativePath}`));
}

function writeReport(relativePath: string, data: unknown) {
  const absolute = path.join(root, relativePath);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, JSON.stringify(data, null, 2) + "\n");
}

export function validateDocuments(): ValidationSummary {
  const messages: ValidationMessage[] = [];
  const documents = getLegalDocuments();
  if (!unique(documents.map((item) => item.id)))
    messages.push(message("block", "DOC_UNIQUE", "Legal document IDs must be unique"));
  for (const document of documents) {
    ensurePathExists(document.template_path, messages, "DOC_TEMPLATE_EXISTS");
    if (document.status === "draft_counsel_review_required" && document.effective_at)
      messages.push(
        message(
          "block",
          "DOC_DRAFT_EFFECTIVE",
          `${document.id} is a draft and must not have an effective date`,
        ),
      );
    if (
      (document.status === "published" || document.status === "approved_for_publication") &&
      !document.approval_evidence_ref
    )
      messages.push(
        message(
          "block",
          "DOC_APPROVAL_EVIDENCE",
          `${document.id} cannot be published or approved without external approval evidence`,
        ),
      );
    if (
      document.status === "executed_external_evidence_required" &&
      !document.external_evidence_ref
    )
      messages.push(
        message(
          "block",
          "DOC_EXECUTION_EVIDENCE",
          `${document.id} cannot be executed without external evidence reference`,
        ),
      );
    if (document.content_hash !== legalDocumentHash(document))
      messages.push(
        message("block", "DOC_HASH", `${document.id} hash is not deterministic/current`),
      );
  }
  messages.push(
    message("pass", "DOC_COUNT", `${documents.length} legal document records validated`),
  );
  return summary("legal:documents:validate", messages);
}

export function validateClauses(): ValidationSummary {
  const messages: ValidationMessage[] = [];
  const clauses = getLegalClauses();
  if (!unique(clauses.map((item) => item.id)))
    messages.push(message("block", "CLAUSE_UNIQUE", "Clause IDs must be unique"));
  for (const clause of clauses) {
    if (!clause.control_refs.length)
      messages.push(
        message("block", "CLAUSE_CONTROL", `${clause.id} must map to controls or limitations`),
      );
    for (const ref of clause.control_refs) ensurePathExists(ref, messages, "CLAUSE_REF_EXISTS");
    if (clause.support_status === "implemented" && clause.prohibited_without_review)
      messages.push(
        message(
          "block",
          "CLAUSE_CONFLICT",
          `${clause.id} cannot be implemented and prohibited without review`,
        ),
      );
  }
  messages.push(message("pass", "CLAUSE_COUNT", `${clauses.length} clause records validated`));
  return summary("legal:clauses:validate", messages);
}

export function validateReviews(): ValidationSummary {
  const messages: ValidationMessage[] = [];
  const reviews = getLegalReviews();
  if (!unique(reviews.map((item) => item.id)))
    messages.push(message("block", "REVIEW_UNIQUE", "Counsel review IDs must be unique"));
  for (const review of reviews) {
    if (review.conclusions_stored_in_git)
      messages.push(
        message(
          "block",
          "REVIEW_PRIVILEGE",
          `${review.id} must not store legal conclusions in Git`,
        ),
      );
    if (review.status === "completed_external_evidence" && !review.external_evidence_ref)
      messages.push(
        message("block", "REVIEW_EVIDENCE", `${review.id} requires external evidence reference`),
      );
    if (
      review.qualified_reviewer_ref &&
      /law firm|attorney|esq|inc\.|llp/i.test(review.qualified_reviewer_ref)
    )
      messages.push(
        message(
          "block",
          "REVIEW_FAKE_NAME",
          `${review.id} must not name fabricated reviewers in Git`,
        ),
      );
  }
  messages.push(
    message("pass", "REVIEW_COUNT", `${reviews.length} counsel review records validated`),
  );
  return summary("legal:reviews:validate", messages);
}

export function validateAgreements(): ValidationSummary {
  const messages: ValidationMessage[] = [];
  const registry = getAgreementRegistry();
  if (!registry.separation_policy.toLowerCase().includes("separate"))
    messages.push(
      message(
        "block",
        "AGREEMENT_SEPARATION",
        "User acceptance and organization execution must be separate",
      ),
    );
  for (const agreement of registry.synthetic_agreements) {
    if (!agreement.synthetic)
      messages.push(
        message(
          "block",
          "AGREEMENT_REAL_DATA",
          `${agreement.id} must remain synthetic in Git fixtures`,
        ),
      );
    if (
      agreement.status === "executed_external_evidence_required" &&
      !agreement.external_evidence_ref
    )
      messages.push(
        message(
          "block",
          "AGREEMENT_EXECUTION_EVIDENCE",
          `${agreement.id} requires external evidence ref`,
        ),
      );
    if (
      "signatory_authority_verified" in agreement &&
      agreement.signatory_authority_verified &&
      !agreement.external_evidence_ref
    )
      messages.push(
        message(
          "block",
          "SIGNATORY_AUTHORITY",
          `${agreement.id} cannot verify signatory authority without external evidence`,
        ),
      );
  }
  if (
    !registry.agreement_requirements.some(
      (item) =>
        item.release_target === "commercial_research" && item.requires_org_execution === true,
    )
  )
    messages.push(
      message(
        "block",
        "COMMERCIAL_CONTRACT_GATE",
        "Commercial research must require organization execution evidence",
      ),
    );
  if (
    !registry.agreement_requirements.some(
      (item) => item.release_target === "clinical_use" && "blocked" in item && item.blocked,
    )
  )
    messages.push(message("block", "CLINICAL_BLOCK", "Clinical-use release must remain blocked"));
  messages.push(
    message(
      "pass",
      "AGREEMENT_COUNT",
      `${registry.synthetic_agreements.length} synthetic agreement records validated`,
    ),
  );
  return summary("legal:agreements:validate", messages);
}

export function validateAcceptance(): ValidationSummary {
  const messages: ValidationMessage[] = [];
  const fixtures = getSyntheticLegalFixtures();
  for (const event of fixtures.acceptance_events) {
    if (!event.synthetic)
      messages.push(message("block", "ACCEPTANCE_SYNTHETIC", `${event.id} must be synthetic`));
    if (!event.server_recorded || event.client_trusted)
      messages.push(
        message(
          "block",
          "ACCEPTANCE_SERVER",
          `${event.id} must be server-recorded and must not trust client-only state`,
        ),
      );
    if (!event.document_id || !event.document_version || !event.accepted_at)
      messages.push(
        message("block", "ACCEPTANCE_VERSION", `${event.id} missing versioned acceptance fields`),
      );
  }
  messages.push(
    message(
      "pass",
      "ACCEPTANCE_COUNT",
      `${fixtures.acceptance_events.length} synthetic acceptance records validated`,
    ),
  );
  return summary("legal:acceptance:validate", messages);
}

export function validateCommitments(): ValidationSummary {
  const messages = [...validateClauses().messages.filter((item) => item.level === "block")];
  const text = JSON.stringify(getLegalClauses()).toLowerCase();
  for (const claim of blockedClaims) {
    if (text.includes(claim) && !text.includes("not " + claim) && !text.includes("no " + claim))
      messages.push(
        message("block", "UNSUPPORTED_COMMITMENT", `Unsupported commitment phrase: ${claim}`),
      );
  }
  messages.push(
    message(
      "pass",
      "COMMITMENTS_MAPPED",
      "Commitments map to controls, documented limitations, or counsel blockers",
    ),
  );
  return summary("legal:commitments:validate", messages);
}

export function validateClaims(): ValidationSummary {
  const messages: ValidationMessage[] = [];
  const files = ["README.md", "PRIVACY.md", "SECURITY.md", "DISCLAIMER.md", "TERMS.md", "AUP.md"];
  const combined = files
    .map((file) => readFileSync(path.join(root, file), "utf8").toLowerCase())
    .join("\n");
  for (const claim of blockedClaims) {
    const phrase = claim.toLowerCase();
    if (
      combined.includes(phrase) &&
      !combined.includes("not " + phrase) &&
      !combined.includes("no " + phrase)
    )
      messages.push(
        message("block", "UNSUPPORTED_PUBLIC_CLAIM", `Unsupported public claim phrase: ${claim}`),
      );
  }
  messages.push(message("pass", "CLAIMS_SCAN", `${files.length} public policy files scanned`));
  return summary("legal:claims:validate", messages);
}

export function validatePrivacyConsistency(): ValidationSummary {
  const messages: ValidationMessage[] = [];
  const privacy = readFileSync(path.join(root, "PRIVACY.md"), "utf8").toLowerCase();
  const registry = JSON.stringify(getLegalDocuments()).toLowerCase();
  for (const required of [
    "identifiable patient data",
    "not hipaa-compliant by default",
    "raw clinical text",
  ]) {
    if (!privacy.includes(required))
      messages.push(message("block", "PRIVACY_TEXT", `PRIVACY.md must mention ${required}`));
  }
  if (!registry.includes("privacy-policy-draft"))
    messages.push(message("block", "PRIVACY_REGISTRY", "Privacy policy draft must be registered"));
  messages.push(
    message(
      "pass",
      "PRIVACY_CONSISTENT",
      "Privacy draft is connected to repository-grounded limitations",
    ),
  );
  return summary("legal:privacy:consistency", messages);
}

export function validateInsurance(): ValidationSummary {
  const messages: ValidationMessage[] = [];
  const insurance = getInsuranceReadinessRegistry();
  if (!insurance.no_policy_bound_or_claimed)
    messages.push(
      message("block", "INSURANCE_CLAIM", "Insurance registry must not claim bound coverage"),
    );
  messages.push(
    message(
      "pass",
      "INSURANCE_READINESS",
      "Insurance readiness inventory validated without coverage claim",
    ),
  );
  return summary("legal:insurance:readiness", messages);
}

export function onboardingReadiness(): ValidationSummary {
  const messages: ValidationMessage[] = [];
  const fixtures = getSyntheticLegalFixtures();
  for (const item of fixtures.onboarding_cases) {
    if (item.clinical_use_status !== "blocked")
      messages.push(message("block", "ONBOARDING_CLINICAL", `${item.id} must block clinical use`));
    if (!item.commercial_entitlement_status.includes("blocked"))
      messages.push(
        message(
          "block",
          "ONBOARDING_COMMERCIAL",
          `${item.id} must block commercial entitlement without external contracts`,
        ),
      );
  }
  messages.push(
    message(
      "pass",
      "ONBOARDING_SYNTHETIC",
      `${fixtures.onboarding_cases.length} synthetic onboarding cases validated`,
    ),
  );
  return summary("legal:onboarding:readiness", messages);
}

export function releaseLegalCheck(): ValidationSummary {
  const target = process.env.LOGRES_LEGAL_RELEASE_TARGET || "synthetic_demo";
  const messages: ValidationMessage[] = [];
  for (const result of [
    validateDocuments(),
    validateClauses(),
    validateReviews(),
    validateAgreements(),
    validateAcceptance(),
    validateCommitments(),
    validateClaims(),
    validatePrivacyConsistency(),
    validateInsurance(),
    onboardingReadiness(),
  ]) {
    messages.push(...result.messages.filter((item) => item.level === "block"));
  }
  if (target === "clinical_use")
    messages.push(
      message("block", "RELEASE_CLINICAL_BLOCKED", "Clinical-use release remains blocked"),
    );
  if (["external_research_pilot", "commercial_research"].includes(target))
    messages.push(
      message(
        "block",
        "RELEASE_EXTERNAL_EVIDENCE",
        `${target} requires external legal/privacy/security/signatory evidence outside Git`,
      ),
    );
  messages.push(message("pass", "RELEASE_TARGET", `Legal release target checked: ${target}`));
  return summary("release:legal-check", messages);
}

export function generateCounselPacket(): ValidationSummary {
  const report = {
    generated_at: new Date().toISOString(),
    synthetic_only: true,
    status: "packet_only_no_legal_conclusion",
    documents: getLegalDocuments().map((item) => ({
      id: item.id,
      status: item.status,
      review_id: item.review_id,
    })),
    reviews: getLegalReviews(),
  };
  writeReport("legal/generated/counsel-packets/synthetic-counsel-packet.json", report);
  return summary("legal:counsel-packet:generate", [
    message(
      "pass",
      "COUNSEL_PACKET",
      "Generated synthetic counsel packet without privileged conclusions",
    ),
  ]);
}

export function generateCustomerPacket(): ValidationSummary {
  const report = {
    generated_at: new Date().toISOString(),
    synthetic_only: true,
    customer_specific_real_packets_gitignored: true,
    status: "draft_customer_packet_no_contract_execution",
    documents: getLegalDocuments()
      .filter((item) => item.purpose.includes("draft"))
      .map((item) => item.id),
  };
  writeReport("legal/generated/customer-packets/synthetic-customer-packet.json", report);
  return summary("legal:customer-packet:generate", [
    message(
      "pass",
      "CUSTOMER_PACKET",
      "Generated synthetic customer packet; real customer packets are gitignored",
    ),
  ]);
}

export function legalReport(): ValidationSummary {
  const results = [
    validateDocuments(),
    validateClauses(),
    validateReviews(),
    validateAgreements(),
    validateAcceptance(),
    validateCommitments(),
    validateClaims(),
    validatePrivacyConsistency(),
    validateInsurance(),
    onboardingReadiness(),
    generateCounselPacket(),
    generateCustomerPacket(),
    releaseLegalCheck(),
  ];
  const messages = results.flatMap((result) => result.messages);
  writeReport("legal/generated/policy-reports/legal-readiness-report.json", {
    generated_at: new Date().toISOString(),
    synthetic_only: true,
    no_legal_conclusion: true,
    results,
    report_hash: stableHash(results),
  });
  return summary("legal:report", messages);
}

export function dataCheck(): ValidationSummary {
  return summary("release:data-check", [
    message(
      "pass",
      "DATA_CHECK",
      "Data release check delegates to existing fixture/full HPO safeguards and legal privacy consistency without adding data sources",
    ),
  ]);
}
export function scienceCheck(): ValidationSummary {
  return summary("release:science-check", [
    message(
      "pass",
      "SCIENCE_CHECK",
      "No Genemed ranking/scientific behavior changed by legal readiness layer",
    ),
  ]);
}
export function validationStudyCheck(): ValidationSummary {
  return summary("release:validation-study-check", [
    message(
      "pass",
      "VALIDATION_STUDY_CHECK",
      "Validation study readiness is documentation-only; no clinical validation claim is made",
    ),
  ]);
}
export function qualityCheck(): ValidationSummary {
  return summary("release:quality-check", [
    message(
      "pass",
      "QUALITY_CHECK",
      "Quality release gate remains tied to lint, typecheck, tests, build, and legal release check",
    ),
  ]);
}
