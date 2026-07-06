import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("release check secret-file guards", () => {
  const source = readFileSync("scripts/deployment/release-check.ts", "utf8");

  it("fails unsafe local secret artifacts instead of silently shipping them", () => {
    expect(source).toContain("localSecretArtifacts");
    expect(source).toContain(".env.docker");
    expect(source).toContain(".neon");
    expect(source).toContain("assertLocalSecretArtifactsIgnored");
    expect(source).toContain("Local secret files must be ignored and untracked before release");
  });
});
