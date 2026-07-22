import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canEnableGenemedEntitlement } from "../../lib/legal/access";
import { legalDocumentHash } from "../../lib/legal/hash";
import { getAgreementRegistry, getLegalDocuments } from "../../lib/legal/registry";

const root = process.cwd();
const tsx = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");

function run(command: string, env: Record<string, string | undefined> = {}) {
  return execFileSync(process.execPath, [tsx, "scripts/legal/cli.ts", command], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function runFailure(command: string, env: Record<string, string | undefined> = {}) {
  const result = spawnSync(process.execPath, [tsx, "scripts/legal/cli.ts", command], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  expect(result.status).not.toBe(0);
  return result.stdout + result.stderr;
}

describe("legal readiness foundation", () => {
  it("registers draft documents with deterministic hashes and no fake effective approval", () => {
    const documents = getLegalDocuments();
    expect(documents.length).toBeGreaterThanOrEqual(10);
    expect(new Set(documents.map((item) => item.id)).size).toBe(documents.length);
    for (const document of documents) {
      expect(document.status).toBe("draft_counsel_review_required");
      expect(document.effective_at).toBeNull();
      expect(document.approval_evidence_ref).toBeNull();
      expect(document.content_hash).toBe(legalDocumentHash(document));
    }
  });

  it("separates user policy acceptance from organization execution", () => {
    const registry = getAgreementRegistry();
    expect(registry.separation_policy).toMatch(/separate/i);
    expect(
      registry.synthetic_agreements.some((item) => item.type === "user_policy_acceptance"),
    ).toBe(true);
    expect(
      registry.synthetic_agreements.some(
        (item) => item.type === "research_pilot_agreement" && item.status === "draft_not_executed",
      ),
    ).toBe(true);
  });

  it("blocks commercial and clinical entitlement paths without external evidence", () => {
    expect(
      canEnableGenemedEntitlement({
        organizationId: "org_a",
        releaseTarget: "synthetic_demo",
        commercial: false,
      }).allowed,
    ).toBe(true);
    expect(
      canEnableGenemedEntitlement({
        organizationId: "org_a",
        releaseTarget: "commercial_research",
        commercial: true,
      }).allowed,
    ).toBe(false);
    expect(
      canEnableGenemedEntitlement({
        organizationId: "org_a",
        releaseTarget: "clinical_use",
        commercial: false,
      }).allowed,
    ).toBe(false);
  });

  it("runs legal commands offline", () => {
    for (const command of [
      "documents:validate",
      "clauses:validate",
      "reviews:validate",
      "agreements:validate",
      "acceptance:validate",
      "commitments:validate",
      "claims:validate",
      "privacy:consistency",
      "counsel-packet:generate",
      "customer-packet:generate",
      "insurance:readiness",
      "onboarding:readiness",
      "report",
      "release:legal-check",
      "release:data-check",
      "release:science-check",
      "release:validation-study-check",
      "release:quality-check",
    ])
      expect(run(command)).toContain("PASS");
  }, 20000);

  it("fails external/commercial and clinical legal release targets clearly", () => {
    expect(
      runFailure("release:legal-check", {
        LOGRES_LEGAL_RELEASE_TARGET: "commercial_research",
      }).toLowerCase(),
    ).toContain("external legal/privacy/security/signatory evidence");
    expect(
      runFailure("release:legal-check", { LOGRES_LEGAL_RELEASE_TARGET: "clinical_use" }),
    ).toMatch(/Clinical-use release remains blocked/i);
  });

  it("keeps public copy away from unsupported legal and clinical claims", () => {
    const text = [
      read("TERMS.md"),
      read("AUP.md"),
      read("docs/legal/COUNSEL_READINESS.md"),
      read("legal/templates/security-exhibit.md"),
    ]
      .join("\\n")
      .toLowerCase();
    expect(text).not.toMatch(
      /soc 2 certified|hipaa compliant service|fda cleared|causal gene found|disease confirmed|uptime guarantee/,
    );
    expect(text).toContain("not legal advice");
    expect(text).toContain("clinical use is blocked");
  });

  it("does not introduce GeneCards scraping or paid-service requirements", () => {
    const files = [
      "lib/legal/validation.ts",
      "scripts/legal/cli.ts",
      "legal/registry/clauses.json",
      "docs/legal/README.md",
    ]
      .map(read)
      .join("\\n");
    expect(files).not.toMatch(/scrape.*genecards|genecards.*scrape/i);
    expect(files).not.toMatch(/stripe|payment required|paid api/i);
  });
});
