import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("deployment Docker and CI configuration", () => {
  it("keeps Dockerfile production-oriented and non-root", () => {
    const dockerfile = read("Dockerfile");

    expect(dockerfile).toContain("npm ci");
    expect(dockerfile).toContain("npm run db:generate");
    expect(dockerfile).toContain("USER nextjs");
    expect(dockerfile).toContain("HEALTHCHECK");
    expect(dockerfile).not.toContain("COPY .env");
  });

  it("defines docker compose app and postgres services with safe defaults", () => {
    const compose = read("docker-compose.yml");

    expect(compose).toContain("postgres:");
    expect(compose).toContain("app:");
    expect(compose).toContain("GENE_CARDS_LICENSED_IMPORT_ENABLED");
    expect(compose).toContain("condition: service_healthy");
    expect(existsSync(resolve(process.cwd(), ".env.docker.example"))).toBe(true);
  });

  it("keeps secrets and generated artifacts out of Docker and git contexts", () => {
    const dockerignore = read(".dockerignore");
    const gitignore = read(".gitignore");

    expect(dockerignore).toContain(".env*");
    expect(dockerignore).toContain("!.env.example");
    expect(dockerignore).toContain("!.env.docker.example");
    expect(dockerignore).toContain("data/hpo/raw");
    expect(gitignore).toContain("/prisma/*.db");
    expect(gitignore).toContain("!.env.docker.example");
  });
});
