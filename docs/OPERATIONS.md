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

## Docker Compose

Docker Compose uses PostgreSQL. The Dockerfile generates Prisma Client from
`prisma/postgresql/schema.prisma`; local and Codespaces development continue to use the default
SQLite schema at `prisma/schema.prisma`.

```bash
cp .env.docker.example .env.docker
# rotate ADMIN_INGEST_SECRET in .env.docker
npm run docker:build
npm run docker:up
SMOKE_BASE_URL=http://localhost:3000 npm run smoke:api
npm run docker:down
```

Compose waits for `postgres`, runs the one-time `migrate` service
(`db:migrate:postgres:deploy`, `data:seed`, `data:build-hpo`), and starts `app` only after that job
completes. If raw HPO files are absent, the import uses bundled synthetic fixtures.

## HPO Data

`npm run data:build-hpo` imports bundled synthetic fixtures when raw HPO files are absent. For full HPO data, run `npm run data:download-hpo` and `npm run data:update` from a trusted CLI environment with appropriate storage. Do not run long imports from a public API request.

## Licensed GeneCards Data

GeneCards linkouts are pure URL generation. Licensed GeneCards/GeneALaCart import remains disabled by default and requires admin upload, feature flag, license confirmation, and audit logging. Do not scrape or automate GeneCards public pages.

## Backups and Rollback

Keep database backups before schema migrations, HPO imports, and licensed data imports. Roll back application code by redeploying the previous artifact; roll back data only from a tested database backup or forward migration plan.

## HPO Import Modes

The HPO importer supports an explicit `HPO_IMPORT_MODE` environment variable with two allowed values:

- `fixture`: bounded synthetic HPO fixtures for tests, CI, local verification, and fast demos. This is the default.
- `full`: production/staging import from raw HPO files in `data/hpo/raw/`.

Fixture import:

```bash
HPO_IMPORT_MODE=fixture npm run data:build-hpo
```

Full production import:

```bash
npm run data:download-hpo
HPO_IMPORT_MODE=full npm run data:build-hpo
```

The full mode uses the official HPO download locations already allowlisted by `npm run data:download-hpo`: `hp.obo`, `phenotype_to_genes.txt`, and `genes_to_phenotype.txt`. Full mode fails if those raw files are missing. It also rejects `HPO_ASSOCIATION_IMPORT_LIMIT`; use fixture mode for bounded verification.

Check imported counts through health:

```bash
curl -s http://localhost:3000/api/health | jq '.data.data.counts'
```

GeneCards remains linkout/import-only as documented elsewhere; HPO import modes do not scrape GeneCards or add OMIM/ClinVar/VCF/Exomiser/model-training behavior.
