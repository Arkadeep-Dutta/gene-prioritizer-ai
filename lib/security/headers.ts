import { buildContentSecurityPolicy, getCspHeaderName } from "./csp";
import { getSecurityConfig } from "./config";

export function getSecurityHeaders(): Record<string, string> {
  const config = getSecurityConfig();
  if (!config.securityHeadersEnabled) return {};

  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "X-DNS-Prefetch-Control": "off",
  };

  if (config.cspEnabled) {
    headers[getCspHeaderName()] = buildContentSecurityPolicy();
  }

  if (config.appEnv === "production") {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";
  }

  return headers;
}

export function applySecurityHeaders(headers: Headers): Headers {
  Object.entries(getSecurityHeaders()).forEach(([name, value]) => headers.set(name, value));
  return headers;
}
