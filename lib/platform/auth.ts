export type PlatformEnvironment = "development" | "test" | "production";
export function isDevelopmentAuthAllowed(
  env: PlatformEnvironment,
  explicitFlag: string | undefined,
): boolean {
  if (env === "production") return false;
  return explicitFlag === "true";
}
export function assertProductionAuthConfigured(
  env: PlatformEnvironment,
  providerConfigured: boolean,
  developmentAuthFlag: string | undefined,
): void {
  if (env === "production" && developmentAuthFlag === "true")
    throw new Error("Synthetic development authentication is blocked in production.");
  if (env === "production" && !providerConfigured)
    throw new Error("Production authentication provider configuration is required.");
}
export function secureCookiePolicy(env: PlatformEnvironment) {
  return { httpOnly: true, sameSite: "lax" as const, secure: env === "production" };
}
export function isAllowedRedirect(url: string, allowedOrigins: string[]): boolean {
  try {
    const parsed = new URL(url);
    return allowedOrigins.includes(parsed.origin);
  } catch {
    return false;
  }
}
