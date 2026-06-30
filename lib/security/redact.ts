import { createHash } from "node:crypto";

const SECRET_KEY_PATTERN = /(key|secret|token|password|authorization|cookie|database_url|api_key)/i;
const CLINICAL_TEXT_KEYS = new Set([
  "text",
  "freeText",
  "rawText",
  "clinicalText",
  "phenotypeText",
]);
const REDACTED = "[REDACTED]";
const OMITTED = "[OMITTED_PRIVACY_TEXT]";

export function hashIdentifier(value: string | null | undefined): string | null {
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex");
}

export function redactSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item)) as T;
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
      key,
      SECRET_KEY_PATTERN.test(key) ? REDACTED : redactSecrets(nested),
    ]),
  ) as T;
}

export function redactClinicalText<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => redactClinicalText(item)) as T;
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
      key,
      CLINICAL_TEXT_KEYS.has(key) && typeof nested === "string"
        ? OMITTED
        : redactClinicalText(nested),
    ]),
  ) as T;
}

export function safeLogMetadata(metadata: Record<string, unknown> = {}): Record<string, unknown> {
  return redactClinicalText(redactSecrets(metadata));
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwardedFor ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}
