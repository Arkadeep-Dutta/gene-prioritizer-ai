export type TenantRecord = { organization_id: string };
export type Membership = { organization_id: string; user_id: string; status: string; role: string };
export function assertTenantAccess(record: TenantRecord, membership: Membership | undefined): void {
  if (
    !membership ||
    membership.status !== "active" ||
    membership.organization_id !== record.organization_id
  )
    throw new Error("Cross-tenant access denied.");
}
export function resolveActiveOrganization(
  serverMemberships: Membership[],
  requestedOrganizationId: string,
): Membership {
  const membership = serverMemberships.find(
    (item) => item.organization_id === requestedOrganizationId && item.status === "active",
  );
  if (!membership) throw new Error("Active organization context must be server-validated.");
  return membership;
}
