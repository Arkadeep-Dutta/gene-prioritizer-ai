export type AuditEvent = {
  event_type: string;
  organization_id?: string;
  product_id?: string;
  actor_id?: string;
  metadata?: Record<string, unknown>;
};
const required = new Set([
  "login",
  "logout",
  "role_change",
  "entitlement_change",
  "analysis_export",
  "deletion_request",
  "denied_cross_tenant_access",
  "support_access",
]);
export function validateAuditEvent(event: AuditEvent): void {
  if (!event.event_type) throw new Error("Audit event type is required.");
  const text = JSON.stringify(event.metadata ?? {});
  if (/token|secret|rawPhenotype|medical record/i.test(text))
    throw new Error("Audit metadata contains prohibited sensitive content.");
}
export function requiredAuditEvents(): string[] {
  return Array.from(required);
}
