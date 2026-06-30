import { describe, expect, it } from "vitest";

import {
  hashIdentifier,
  redactClinicalText,
  redactSecrets,
  safeLogMetadata,
} from "@/lib/security/redact";

describe("privacy-safe redaction helpers", () => {
  it("redacts secret-like keys recursively", () => {
    const redacted = redactSecrets({
      authorization: "Bearer secret",
      nested: { DATABASE_URL: "file:./dev.db", api_key: "abc" },
      safe: "value",
    });

    expect(redacted).toEqual({
      authorization: "[REDACTED]",
      nested: { DATABASE_URL: "[REDACTED]", api_key: "[REDACTED]" },
      safe: "value",
    });
  });

  it("omits raw clinical text fields from log metadata", () => {
    const metadata = safeLogMetadata({
      text: "Infant with seizures and feeding difficulty",
      hpoTerms: ["HP:0001250"],
      token: "secret-token",
    });

    expect(JSON.stringify(metadata)).not.toContain("Infant with seizures");
    expect(metadata.text).toBe("[OMITTED_PRIVACY_TEXT]");
    expect(metadata.token).toBe("[REDACTED]");
  });

  it("hashes identifiers deterministically without preserving the input", () => {
    const first = hashIdentifier("198.51.100.7");
    const second = hashIdentifier("198.51.100.7");

    expect(first).toBe(second);
    expect(first).not.toContain("198.51.100.7");
  });

  it("redacts clinical text independently from secret redaction", () => {
    const redacted = redactClinicalText({ rawText: "patient note", label: "safe" });

    expect(redacted).toEqual({ rawText: "[OMITTED_PRIVACY_TEXT]", label: "safe" });
  });
});
