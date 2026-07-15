import roles from "../../platform/rbac/roles.json";
export type OrganizationRole = keyof typeof roles.organization_roles;
export type PlatformRole = keyof typeof roles.platform_roles;
export function permissionsForOrganizationRole(role: OrganizationRole): string[] {
  return [...(roles.organization_roles[role] ?? [])];
}
export function permissionsForPlatformRole(role: PlatformRole): string[] {
  return [...(roles.platform_roles[role] ?? [])];
}
export function hasPermission(
  role: OrganizationRole | PlatformRole | undefined,
  permission: string,
): boolean {
  if (!role) return false;
  return [
    ...permissionsForOrganizationRole(role as OrganizationRole),
    ...permissionsForPlatformRole(role as PlatformRole),
  ].includes(permission);
}
export function denyByDefault(permission: string, permissions: string[] = []): boolean {
  return permissions.includes(permission);
}
