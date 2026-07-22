import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LOGRES_BRAND } from "../../lib/platform/brand";
import { getGenemedProduct } from "../../lib/platform/products";
import { isDevelopmentAuthAllowed, assertProductionAuthConfigured } from "../../lib/platform/auth";
import { hasPermission } from "../../lib/platform/rbac";
import { assertTenantAccess } from "../../lib/platform/tenancy";
import { containsLikelyIdentifier, redactForLog } from "../../lib/platform/privacy";
const root = process.cwd();
const tsx = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
function run(command: string) {
  return execFileSync(process.execPath, [tsx, "scripts/platform/cli.ts", command], {
    cwd: root,
    encoding: "utf8",
  });
}
function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8")) as T;
}
describe("Logres platform foundation", () => {
  it("identifies Logres and registers Genemed exactly once", () => {
    expect(LOGRES_BRAND.platformId).toBe("logres");
    expect(LOGRES_BRAND.primaryProductId).toBe("genemed");
    const registry = readJson<{
      products: Array<{ product_id: string; clinical_use_status: string }>;
    }>("platform/products/registry.json");
    expect(registry.products.filter((item) => item.product_id === "genemed")).toHaveLength(1);
    expect(getGenemedProduct().clinical_use_status).toBe("blocked");
  });
  it("blocks development auth in production", () => {
    expect(isDevelopmentAuthAllowed("development", "true")).toBe(true);
    expect(isDevelopmentAuthAllowed("production", "true")).toBe(false);
    expect(() => assertProductionAuthConfigured("production", false, undefined)).toThrow(
      /required/,
    );
    expect(() => assertProductionAuthConfigured("production", true, "true")).toThrow(/blocked/);
  });
  it("enforces RBAC deny-by-default and tenant isolation", () => {
    expect(hasPermission("viewer", "genemed.analysis.save")).toBe(false);
    expect(hasPermission("analyst", "genemed.analysis.save")).toBe(true);
    expect(() =>
      assertTenantAccess(
        { organization_id: "org_a" },
        { organization_id: "org_b", user_id: "usr", status: "active", role: "viewer" },
      ),
    ).toThrow(/Cross-tenant/);
  });
  it("redacts likely identifiers and avoids raw phenotype logging", () => {
    expect(containsLikelyIdentifier("medical record 123")).toBe(true);
    expect(redactForLog("medical record 123")).toBe("[REDACTED_IDENTIFIER_WARNING]");
  });
  it("runs the platform validation commands offline", () => {
    for (const command of [
      "products:validate",
      "brand:validate",
      "auth:validate",
      "auth:configuration-check",
      "sessions:verify",
      "rbac:validate",
      "rbac:verify",
      "tenant-isolation:test",
      "entitlements:validate",
      "data-classification:validate",
      "privacy:validate",
      "retention:validate",
      "deletion:dry-run",
      "secrets:validate",
      "audit:verify",
      "rate-limits:verify",
      "backup:check",
      "restore:verify",
      "vendors:validate",
      "threat-model:validate",
      "security:test",
      "security-questionnaire:generate",
      "soc2:readiness",
      "report",
      "synthetic-workflow",
      "release:logres-check",
    ])
      expect(run(command)).toContain("PASS");
  }, 20000);
});
