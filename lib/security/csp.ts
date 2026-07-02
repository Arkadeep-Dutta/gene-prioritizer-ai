import { getSecurityConfig } from "./config";

export function buildContentSecurityPolicy(): string {
  const config = getSecurityConfig();
  const isDevelopment = config.appEnv !== "production";
  const scriptSrc = ["'self'"];
  const styleSrc = ["'self'", "'unsafe-inline'"];
  const connectSrc = ["'self'", ...config.trustedOrigins];

  if (isDevelopment) {
    scriptSrc.push("'unsafe-inline'", "'unsafe-eval'");
    connectSrc.push("ws:", "http://localhost:*", "http://127.0.0.1:*");
  }

  connectSrc.push("https://eutils.ncbi.nlm.nih.gov", "https://rest.genenames.org");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    `style-src ${styleSrc.join(" ")}`,
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src ${Array.from(new Set(connectSrc)).join(" ")}`,
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function getCspHeaderName():
  | "Content-Security-Policy"
  | "Content-Security-Policy-Report-Only" {
  return getSecurityConfig().cspReportOnly
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";
}
