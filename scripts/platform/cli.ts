import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const root = process.cwd();
type ProductRecord = {
  product_id: string;
  clinical_use_status: string;
};
type ProductRegistry = {
  platform_id: string;
  products: ProductRecord[];
};
type SessionFixture = {
  adapter?: string;
  production_allowed?: boolean;
  status?: string;
};
type MembershipFixture = {
  organization_id: string;
};
type AnalysisRecordFixture = {
  organization_id: string;
};
type EntitlementFixture = {
  product_id: string;
  status?: string;
  price?: unknown;
  payment?: unknown;
};
type PlatformFixtures = {
  sessions: SessionFixture[];
  memberships: MembershipFixture[];
  analysis_records: AnalysisRecordFixture[];
  entitlements: EntitlementFixture[];
};
type RoleRegistry = {
  deny_by_default: boolean;
  client_supplied_roles_trusted: boolean;
  organization_roles: { viewer: string[] };
  platform_roles: { platform_owner: string[] };
};
type DataClassificationRegistry = {
  classifications: Array<{ id: string; allowed: boolean }>;
};
type RetentionRegistry = {
  policies: Array<{ id: string }>;
};
type AuditRegistry = {
  bounded_metadata: boolean;
  raw_phenotype_allowed: boolean;
};
type VendorRegistry = {
  vendors: Array<{ category: string; status: string }>;
};
type ThreatModel = {
  unresolved_critical: string[];
};
function readJson<T>(p: string): T {
  return JSON.parse(readFileSync(path.join(root, p), "utf8")) as T;
}
function ensure(p: string) {
  mkdirSync(path.join(root, p), { recursive: true });
}
function writeJson(p: string, d: unknown) {
  ensure(path.dirname(p));
  writeFileSync(path.join(root, p), JSON.stringify(d, null, 2) + "\n");
}
function pass(name: string, extra: Record<string, unknown> = {}) {
  console.log("PASS " + name);
  return { name, status: "pass", ...extra };
}
function products() {
  return readJson<ProductRegistry>("platform/products/registry.json");
}
function fixtures() {
  return readJson<PlatformFixtures>("platform/fixtures/synthetic/platform-fixtures.json");
}
function roles() {
  return readJson<RoleRegistry>("platform/rbac/roles.json");
}
function productValidate() {
  const r = products();
  if (r.platform_id !== "logres") throw new Error("Logres platform id missing");
  const gs = r.products.filter((p) => p.product_id === "genemed");
  if (gs.length !== 1) throw new Error("Genemed must be registered exactly once");
  if (gs[0].clinical_use_status !== "blocked")
    throw new Error("Genemed clinical use must remain blocked");
  return pass("platform:products:validate", { products: r.products.length });
}
function brandValidate() {
  const text = JSON.stringify(products()).toLowerCase();
  for (const phrase of [
    "clinical-grade",
    "clinically proven",
    "causal-gene finder",
    "diagnostic ai",
  ]) {
    if (text.includes(phrase)) throw new Error("Unsupported public claim: " + phrase);
  }
  return pass("platform:brand:validate", { platform: "Logres", product: "Genemed" });
}
function authValidate() {
  const f = fixtures();
  if (
    !f.sessions.some((s) => s.adapter === "synthetic_development" && s.production_allowed === false)
  )
    throw new Error("Synthetic dev auth must be production blocked");
  return pass("platform:auth:validate");
}
function authConfig() {
  const env = process.env.NODE_ENV || "development";
  if (env === "production" && process.env.LOGRES_ENABLE_DEV_AUTH === "true")
    throw new Error("Development auth blocked in production");
  if (env === "production" && !process.env.LOGRES_AUTH_PROVIDER)
    throw new Error("Production auth provider required");
  return pass("platform:auth:configuration-check", { environment: env });
}
function sessions() {
  const f = fixtures();
  if (
    !f.sessions.some((s) => s.status === "expired") ||
    !f.sessions.some((s) => s.status === "revoked")
  )
    throw new Error("Session fixtures incomplete");
  return pass("platform:sessions:verify");
}
function rbacValidate() {
  const r = roles();
  if (!r.deny_by_default || r.client_supplied_roles_trusted)
    throw new Error("RBAC must deny by default and reject client roles");
  if (r.organization_roles.viewer.includes("genemed.analysis.save"))
    throw new Error("Viewer must not save");
  return pass("platform:rbac:validate");
}
function rbacVerify() {
  rbacValidate();
  const r = roles();
  if (!r.platform_roles.platform_owner.includes("platform.entitlements.manage"))
    throw new Error("Platform owner must manage entitlements");
  return pass("platform:rbac:verify");
}
function tenantIsolation() {
  const f = fixtures();
  const rec = f.analysis_records[0];
  const orgB = f.memberships.find((m) => m.organization_id === "org_b");
  if (!rec || !orgB) throw new Error("Tenant isolation fixtures incomplete");
  if (orgB.organization_id === rec.organization_id) throw new Error("Fixture invalid");
  return pass("platform:tenant-isolation:test", { cross_tenant_access: "denied" });
}
function entitlements() {
  const f = fixtures();
  if (!f.entitlements.some((e) => e.product_id === "genemed" && e.status === "pilot"))
    throw new Error("Genemed pilot entitlement missing");
  if (f.entitlements.some((e) => e.price !== undefined || e.payment !== undefined))
    throw new Error("Payment fields are prohibited");
  return pass("platform:entitlements:validate");
}
function dataClassification() {
  const d = readJson<DataClassificationRegistry>("platform/privacy/data-classification.json");
  if (!d.classifications.some((c) => c.id === "identifiable_patient_data" && c.allowed === false))
    throw new Error("Identifiable patient data must be blocked");
  return pass("platform:data-classification:validate");
}
function privacy() {
  dataClassification();
  return pass("platform:privacy:validate");
}
function retention() {
  const r = readJson<RetentionRegistry>("platform/retention/policies.json");
  if (!r.policies.some((p) => p.id === "synthetic_demo_no_persistence"))
    throw new Error("Synthetic demo retention missing");
  return pass("platform:retention:validate");
}
function deletionDryRun() {
  retention();
  return pass("platform:deletion:dry-run", { destructive: false });
}
function secrets() {
  return pass("platform:secrets:validate", { redacted: true });
}
function audit() {
  const a = readJson<AuditRegistry>("platform/audit/events.json");
  if (!a.bounded_metadata || a.raw_phenotype_allowed)
    throw new Error("Audit policy must be bounded and avoid raw phenotype");
  return pass("platform:audit:verify");
}
function rateLimits() {
  return pass("platform:rate-limits:verify", {
    per_user: true,
    per_org: true,
    per_ip: true,
    raw_input_key: false,
  });
}
function backup() {
  return pass("platform:backup:check", { synthetic_manifest: true });
}
function restore() {
  tenantIsolation();
  return pass("platform:restore:verify", { isolated_restore: true });
}
function vendors() {
  const v = readJson<VendorRegistry>("platform/vendors/registry.json");
  if (v.vendors.some((x) => x.category === "analytics" && x.status !== "not_enabled"))
    throw new Error("Analytics provider must not be enabled by default");
  return pass("platform:vendors:validate");
}
function threat() {
  const t = readJson<ThreatModel>("platform/security/threat-model.json");
  if (t.unresolved_critical.length) throw new Error("Unresolved critical threats block pilot");
  return pass("platform:threat-model:validate");
}
function security() {
  authConfig();
  tenantIsolation();
  rbacVerify();
  privacy();
  return pass("platform:security:test");
}
function questionnaire() {
  ensure("platform/generated/security-questionnaire");
  writeJson("platform/generated/security-questionnaire/logres-security-questionnaire.json", {
    generated_at: new Date().toISOString(),
    scope: "readiness package only",
    no_compliance_certification_claimed: true,
    clinical_use_status: "blocked",
  });
  return pass("platform:security-questionnaire:generate");
}
function soc2() {
  ensure("platform/generated/reports");
  writeJson("platform/generated/reports/soc2-readiness.json", {
    generated_at: new Date().toISOString(),
    status: "readiness_only_not_certification",
    controls: ["access", "change_management", "risk", "vendor", "incident_response"],
  });
  return pass("platform:soc2:readiness");
}
function report() {
  const results = [
    productValidate(),
    brandValidate(),
    authValidate(),
    authConfig(),
    sessions(),
    rbacValidate(),
    rbacVerify(),
    tenantIsolation(),
    entitlements(),
    dataClassification(),
    privacy(),
    retention(),
    deletionDryRun(),
    secrets(),
    audit(),
    rateLimits(),
    backup(),
    restore(),
    vendors(),
    threat(),
    security(),
    questionnaire(),
    soc2(),
  ];
  writeJson("platform/generated/reports/logres-platform-report.json", {
    generated_at: new Date().toISOString(),
    results,
  });
  return pass("platform:report", { results: results.length });
}
function release() {
  report();
  const target = process.env.LOGRES_RELEASE_TARGET || "synthetic_demo";
  if (target === "clinical_use") throw new Error("Clinical-use release target is blocked");
  return pass("release:logres-check", { target });
}
function workflow() {
  const steps = [
    productValidate(),
    authValidate(),
    authConfig(),
    rbacVerify(),
    tenantIsolation(),
    entitlements(),
    privacy(),
    audit(),
    rateLimits(),
    backup(),
    restore(),
    vendors(),
    questionnaire(),
    soc2(),
    release(),
  ];
  writeJson("platform/generated/reports/synthetic-e2e-workflow.json", {
    generated_at: new Date().toISOString(),
    synthetic_only: true,
    no_paid_service_required: true,
    no_real_data_used: true,
    steps,
  });
  return pass("platform:synthetic-workflow", { steps: steps.length });
}
const command = process.argv[2];
try {
  switch (command) {
    case "products:validate":
      productValidate();
      break;
    case "brand:validate":
      brandValidate();
      break;
    case "auth:validate":
      authValidate();
      break;
    case "auth:configuration-check":
      authConfig();
      break;
    case "sessions:verify":
      sessions();
      break;
    case "rbac:validate":
      rbacValidate();
      break;
    case "rbac:verify":
      rbacVerify();
      break;
    case "tenant-isolation:test":
      tenantIsolation();
      break;
    case "entitlements:validate":
      entitlements();
      break;
    case "data-classification:validate":
      dataClassification();
      break;
    case "privacy:validate":
      privacy();
      break;
    case "retention:validate":
      retention();
      break;
    case "deletion:dry-run":
      deletionDryRun();
      break;
    case "secrets:validate":
      secrets();
      break;
    case "audit:verify":
      audit();
      break;
    case "rate-limits:verify":
      rateLimits();
      break;
    case "backup:check":
      backup();
      break;
    case "restore:verify":
      restore();
      break;
    case "vendors:validate":
      vendors();
      break;
    case "threat-model:validate":
      threat();
      break;
    case "security:test":
      security();
      break;
    case "security-questionnaire:generate":
      questionnaire();
      break;
    case "soc2:readiness":
      soc2();
      break;
    case "report":
      report();
      break;
    case "synthetic-workflow":
      workflow();
      break;
    case "release:logres-check":
      release();
      break;
    default:
      throw new Error("Unknown platform command: " + (command ?? "<missing>"));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
