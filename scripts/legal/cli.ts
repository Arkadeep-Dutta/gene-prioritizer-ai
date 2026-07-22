import {
  dataCheck,
  generateCounselPacket,
  generateCustomerPacket,
  legalReport,
  onboardingReadiness,
  qualityCheck,
  releaseLegalCheck,
  scienceCheck,
  validateAcceptance,
  validateAgreements,
  validateClaims,
  validateClauses,
  validateCommitments,
  validateDocuments,
  validateInsurance,
  validatePrivacyConsistency,
  validateReviews,
  validationStudyCheck,
} from "../../lib/legal/validation";
import type { ValidationSummary } from "../../lib/legal/types";

const command = process.argv[2];
const json = process.argv.includes("--json");

function emit(summary: ValidationSummary) {
  if (json) console.log(JSON.stringify(summary, null, 2));
  else {
    for (const item of summary.messages) {
      console.log(`${item.level.toUpperCase()} ${item.code}: ${item.message}`);
    }
    console.log(`${summary.status === "pass" ? "PASS" : "FAIL"} ${summary.command}`);
  }
  if (summary.status !== "pass") process.exit(1);
}

const commands: Record<string, () => ValidationSummary> = {
  "documents:validate": validateDocuments,
  "clauses:validate": validateClauses,
  "reviews:validate": validateReviews,
  "agreements:validate": validateAgreements,
  "acceptance:validate": validateAcceptance,
  "commitments:validate": validateCommitments,
  "claims:validate": validateClaims,
  "privacy:consistency": validatePrivacyConsistency,
  "counsel-packet:generate": generateCounselPacket,
  "customer-packet:generate": generateCustomerPacket,
  "insurance:readiness": validateInsurance,
  "onboarding:readiness": onboardingReadiness,
  report: legalReport,
  "release:legal-check": releaseLegalCheck,
  "release:data-check": dataCheck,
  "release:science-check": scienceCheck,
  "release:validation-study-check": validationStudyCheck,
  "release:quality-check": qualityCheck,
};

try {
  const run = command ? commands[command] : undefined;
  if (!run) throw new Error(`Unknown legal command: ${command ?? "<missing>"}`);
  emit(run());
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
