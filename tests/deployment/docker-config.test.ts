import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("deployment Docker and CI configuration", () => {
  it("generates the Docker Prisma client from the PostgreSQL schema", () => {
    const dockerfile = read("Dockerfile");

    expect(dockerfile).toContain("npm run db:generate:postgres");
    expect(dockerfile).not.toContain("RUN npm run db:generate && npm run build");
    expect(dockerfile).toContain("USER nextjs");
    expect(dockerfile).toContain("HEALTHCHECK");
    expect(dockerfile).not.toContain("COPY .env");
  });

  it("keeps SQLite local scripts and defines PostgreSQL deployment scripts", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["db:generate"]).toBe("prisma generate");
    expect(packageJson.scripts["db:generate:postgres"]).toBe(
      "prisma generate --config=prisma/postgresql/prisma.config.ts",
    );
    expect(packageJson.scripts["db:migrate:postgres:deploy"]).toBe(
      "prisma migrate deploy --config=prisma/postgresql/prisma.config.ts",
    );

    const postgresConfig = read("prisma/postgresql/prisma.config.ts");
    expect(postgresConfig).toContain('schema: "schema.prisma"');
    expect(postgresConfig).toContain('path: "migrations"');

    const sqliteMigrationLock = read("prisma/migrations/migration_lock.toml");
    const postgresMigrationLock = read("prisma/postgresql/migrations/migration_lock.toml");
    expect(sqliteMigrationLock).toContain('provider = "sqlite"');
    expect(postgresMigrationLock).toContain('provider = "postgresql"');
  });

  it("defines postgres, migrate, and app services with safe Docker defaults", () => {
    const compose = read("docker-compose.yml");

    expect(compose).toContain("postgres:");
    expect(compose).toContain("migrate:");
    expect(compose).toContain("app:");
    expect(compose).toContain("postgres-data:");
    expect(compose).toContain(
      "postgresql://gene_prio:gene_prio_local_change_me@postgres:5432/gene_prio?schema=public",
    );
    expect(compose).toContain("condition: service_healthy");
    expect(compose).toContain("condition: service_completed_successfully");
    expect(compose).toContain("npm run db:migrate:postgres:deploy");
    expect(compose).toContain("npm run data:seed");
    expect(compose).toContain("npm run data:build-hpo");
    expect(compose).toContain('GENE_CARDS_LICENSED_IMPORT_ENABLED: "false"');
    expect(compose).not.toContain("ADMIN_INGEST_SECRET:");
  });

  it("keeps Docker env placeholders and generated artifacts out of Docker and git contexts", () => {
    const dockerignore = read(".dockerignore");
    const gitignore = read(".gitignore");
    const dockerEnvExample = read(".env.docker.example");

    expect(existsSync(resolve(process.cwd(), ".env.docker.example"))).toBe(true);
    expect(dockerEnvExample).toContain('ADMIN_INGEST_SECRET="replace-this-local-docker-secret"');
    expect(dockerEnvExample).not.toContain("change-me-in-production");
    expect(dockerEnvExample).toContain('GENE_CARDS_LICENSED_IMPORT_ENABLED="false"');
    expect(dockerignore).toContain(".env*");
    expect(dockerignore).toContain("!.env.example");
    expect(dockerignore).toContain("!.env.docker.example");
    expect(dockerignore).toContain("data/hpo/raw");
    expect(dockerignore).toContain(".neon");
    expect(dockerignore).toContain(".cache");
    expect(gitignore).toContain("/prisma/*.db");
    expect(gitignore).toContain(".neon");
    expect(gitignore).toContain(".cache");
    expect(gitignore).toContain("!.env.docker.example");
  });

  it("does not add GeneCards scraping or require licensed imports", () => {
    const compose = read("docker-compose.yml");
    const dockerfile = read("Dockerfile");

    expect(`${compose}
${dockerfile}`).not.toMatch(/scrap/i);
    expect(compose).not.toContain("GENE_CARDS_LICENSED_IMPORT_ENABLED: true");
  });
});
