import { createHash } from "node:crypto";

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  if (value && typeof value === "object") {
    return (
      "{" +
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map(
          (key) =>
            JSON.stringify(key) + ":" + canonicalize((value as Record<string, unknown>)[key]),
        )
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

export function stableHash(value: unknown): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

export function legalDocumentHash<T extends { content_hash?: string }>(document: T): string {
  const clone = { ...document };
  delete clone.content_hash;
  return `legal-doc-sha256:${stableHash(clone)}`;
}
