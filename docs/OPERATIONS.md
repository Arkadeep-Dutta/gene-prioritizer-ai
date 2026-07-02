# Operations

## Runtime Model

```text
browser -> Next.js app/API -> Prisma -> SQLite local/dev or PostgreSQL production
                         -> optional outbound APIs: HGNC, PubMed/NCBI, optional LLM
```

Local and Codespaces deployments may use SQLite. Production deployments should use PostgreSQL with managed backups. The app does not require live external APIs for local verification or CI.

## Commands

```bash
npm run deploy:check
npm run smoke:api
npm run verify
npm run verify:full
npm run release:check
```

`deploy:check` evaluates production warnings without printing secret values. `smoke:api` expects a running app and checks public endpoints, deterministic phenotype extraction, ranking, and secret-leak guardrails.

## Database

SQLite local workflow:

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run data:seed
npm run data:build-hpo
```

PostgreSQL production workflow:

```bash
DATABASE_URL="postgresql://..." DIRECT_URL="postgresql://..." npm run db:generate:postgres
DATABASE_URL="postgresql://..." DIRECT_URL="postgresql://..." npm run db:migrate:prod
npm run data:seed
npm run data:build-hpo
```

Back up PostgreSQL before migrations. Do not run destructive resets automatically in production.

## HPO Data

`npm run data:build-hpo` imports bundled synthetic fixtures when raw HPO files are absent. For full HPO data, run `npm run data:download-hpo` and `npm run data:update` from a trusted CLI environment with appropriate storage. Do not run long imports from a public API request.

## Licensed GeneCards Data

GeneCards linkouts are pure URL generation. Licensed GeneCards/GeneALaCart import remains disabled by default and requires admin upload, feature flag, license confirmation, and audit logging. Do not scrape or automate GeneCards public pages.

## Backups and Rollback

Keep database backups before schema migrations, HPO imports, and licensed data imports. Roll back application code by redeploying the previous artifact; roll back data only from a tested database backup or forward migration plan.
