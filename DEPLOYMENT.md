# Deployment

Gene Prioritizer AI is a Next.js application with Prisma persistence. Every deployment must keep
database access server-side, retain the visible disclaimer, and use HTTPS outside local
development.

## Local and Codespaces: SQLite

Use Node.js 22 (20.9 minimum), then:

```bash
cp .env.example .env
npm install
npm run setup
npm run dev
```

SQLite is the local/demo/CI default. In Codespaces, forward port 3000. Never commit `.env`,
database files, raw HPO downloads, secrets, or sensitive fixtures.

## HPO import after setup

Synthetic seed data is enough for local development and tests. To import public HPO data:

```bash
npm run data:update
```

This downloads approved files into `HPO_DATA_DIR/raw`, computes hashes, and imports local data into
Prisma. Re-running the command is safe and should not duplicate terms or associations.

For Codespaces or small SQLite development databases, `.env.example` sets
`HPO_ASSOCIATION_IMPORT_LIMIT` so the full download/build path can be verified without importing
every public association row. Clear it for full local or production association ingestion.

For production, the recommended process is:

1. migrate the database;
2. run HPO import from a trusted job, workstation, or admin environment;
3. verify `/api/data/version` and `/api/health`;
4. deploy or promote the app.

Do not run long HPO imports inside ordinary user requests.

## HGNC gene validation configuration

HGNC validation is server-side and does not require an API key in Phase 4. Optional environment
variables:

```env
HGNC_API_BASE_URL="https://rest.genenames.org"
HGNC_REQUEST_TIMEOUT_MS="15000"
HGNC_REQUEST_RETRIES="2"
HGNC_CACHE_TTL_SECONDS="86400"
GENE_VALIDATION_BATCH_LIMIT="200"
GENE_CARDS_LINKOUT_ENABLED="true"
GENE_CARDS_LICENSED_IMPORT_ENABLED="false"
```

In environments without outbound network access, gene validation degrades safely. New symbols are
returned as `UNVALIDATED`, not `VALIDATED`. Existing validated local gene records can be returned
from cache with a warning. Do not run live validation in build steps or CI; tests use mocked HGNC
responses.

## Ranking configuration

Phase 5 deterministic ranking is local-database-first and works with `DISABLE_LLM=true`. Add these
safe defaults to deployed environments when overriding `.env.example`:

```env
RANKING_ALGORITHM_VERSION="deterministic-hpo-v1"
RANKING_DEFAULT_LIMIT="25"
RANKING_MAX_LIMIT="100"
RANKING_CANDIDATE_GENE_LIMIT="500"
RANKING_HPO_TERM_LIMIT="100"
RANKING_STORE_RESULTS_DEFAULT="true"
RANKING_PRIVACY_MODE_DEFAULT="true"
```

The ranking API requires the Prisma database, local HPO terms, and gene-phenotype associations. The
synthetic seed is enough for smoke tests; full review workflows should run `npm run data:update` or
`npm run data:build-hpo` after official HPO downloads. Full HPO association imports can be large, so
use PostgreSQL and run imports from an administrative job for production. For Codespaces or small
SQLite checks, `HPO_ASSOCIATION_IMPORT_LIMIT` can verify the import path without loading every
association row.

## Phenotype extraction and optional LLM configuration

Phase 6 free-text extraction works locally with `DISABLE_LLM=true` and requires no API keys. Safe
defaults:

```env
LLM_PROVIDER="none"
LLM_MODEL=""
DISABLE_LLM="true"
GEMINI_API_KEY=""
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
LLM_REQUEST_TIMEOUT_MS="30000"
LLM_REQUEST_RETRIES="1"
LLM_MAX_INPUT_CHARS="8000"

PHENOTYPE_TEXT_MAX_CHARS="8000"
PHENOTYPE_MAX_EXTRACTED_TERMS="100"
PHENOTYPE_SEARCH_LIMIT_PER_PHRASE="10"
PHENOTYPE_REQUIRE_CONFIRMATION="true"
PHENOTYPE_ALLOW_EXTERNAL_LLM="false"
```

External LLM use must be deliberately enabled by environment and by request. If enabled in a future
deployment, warn users that text may be transmitted to the configured provider, keep keys only in
server-side secret stores, and continue verifying every returned HPO ID against the local database.
CI and ordinary builds must not require LLM keys or call live LLM APIs.

## PubMed / NCBI E-utilities configuration

Phase 7 literature search is optional and server-side. Safe defaults:

```env
NCBI_EUTILS_BASE_URL="https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
NCBI_API_KEY=""
NCBI_EMAIL=""
NCBI_TOOL_NAME="gene-prioritizer-ai"
NCBI_REQUEST_TIMEOUT_MS="30000"
NCBI_REQUEST_RETRIES="2"
NCBI_RATE_LIMIT_RPS_NO_KEY="3"
NCBI_RATE_LIMIT_RPS_WITH_KEY="10"

LITERATURE_ENABLED="true"
LITERATURE_DEFAULT_RETMAX="10"
LITERATURE_MAX_RETMAX="25"
LITERATURE_CACHE_TTL_SECONDS="86400"
LITERATURE_MAX_QUERY_LENGTH="500"
LITERATURE_ATTACH_TO_RANKING_DEFAULT="false"
LITERATURE_RANKING_BOOST_MAX="5"
LITERATURE_RANKING_GENE_LIMIT="5"
LITERATURE_LLM_SUMMARIES_ENABLED="false"
LITERATURE_SUMMARY_MAX_ARTICLES="5"
```

The app works without `NCBI_API_KEY`; an API key only increases NCBI's permitted request rate. NCBI
recommends identifying tools with email/tool parameters for production use. Keep the API key in the
platform secret store and never expose it through `NEXT_PUBLIC_*`.

If outbound network is unavailable, `/api/literature/search` returns a structured error and
`/api/prioritize` with `includeLiterature=true` still returns deterministic ranking results with a
warning. The current query cache is in-process and the durable metadata cache is
`LiteratureRecord`; multi-instance production deployments should add a shared cache before high
traffic use. Do not call live PubMed in CI tests; tests use fixtures and mocks.

## Docker Compose

Docker Compose is the production-like local deployment path and uses PostgreSQL, not SQLite. The
Docker image generates Prisma Client from `prisma/postgresql/schema.prisma`; local development keeps
using `prisma/schema.prisma` with SQLite.

```bash
cp .env.docker.example .env.docker
# rotate ADMIN_INGEST_SECRET in .env.docker before exposing admin routes
npm run docker:build
npm run docker:up
SMOKE_BASE_URL=http://localhost:3000 npm run smoke:api
npm run docker:down
```

Compose starts `postgres`, then a one-time `migrate` service runs PostgreSQL migrations,
`npm run data:seed`, and `npm run data:build-hpo` before the `app` service starts. Raw HPO files are
not copied into the image; when they are absent, the HPO build imports bundled synthetic fixtures so
Docker smoke checks stay fast and deterministic. The `postgres-data` volume persists database state,
and Compose does not run destructive resets automatically.

If the app health check reports `URL must start with the protocol file:` or `DATABASE_UNREACHABLE`
while using a PostgreSQL `DATABASE_URL`, the image was generated with the SQLite Prisma schema by
mistake. Rebuild with `npm run docker:build` and confirm the Dockerfile runs
`npm run db:generate:postgres`.

## PostgreSQL production

The canonical local schema is `prisma/schema.prisma`. The matching production schema is
`prisma/postgresql/schema.prisma`, with reviewed production migrations stored beside it.

```bash
npm run db:generate:postgres
npm run db:migrate:postgres
npm run data:update
```

Set `DATABASE_URL` and `DIRECT_URL` in the platform secret store. Never expose them through
`NEXT_PUBLIC_*`, logs, health responses, container images, or committed configuration.

## Platform notes

- **Vercel:** use managed PostgreSQL. Run migrations and HPO imports from CI or a controlled job,
  not during a serverless request. Vercel's filesystem is not durable for SQLite or large HPO raw
  caches.
- **Railway/Render:** attach managed PostgreSQL, run reviewed migrations, then run HPO import as a
  one-off job or trusted shell command.
- **Codespaces:** SQLite plus `npm run data:update` is acceptable for development. The local cache
  can be deleted and recreated from official HPO downloads.

## Storage considerations

Full HPO ontology and association files are public but can be large enough that they should not be
committed. Keep `HPO_DATA_DIR/raw` in persistent storage when imports are expensive, or recreate it
from official sources when needed.

## Phase 8 UI deployment notes

The workflow UI is served by the regular Next.js app and uses the existing API routes:

- `/api/phenotype/extract`
- `/api/genes/validate`
- `/api/prioritize`
- `/api/health`
- `/api/data/version`

No UI API keys are required, and no secrets should be exposed through `NEXT_PUBLIC_*`. The browser
bundle does not import Prisma or database internals. Client-side JSON, CSV, and Markdown exports
exclude raw free text by default.

After deployment, verify that `/` loads with the safety banner, the HPO-code workflow can rank
synthetic terms, the free-text workflow requires HPO confirmation before ranking, the informational
pages load, exports download, and health/version API routes do not expose secrets or file paths.

## Phase 9 production hardening checklist

Set these values explicitly in production secret/config stores:

```env
APP_ENV="production"
SECURITY_HEADERS_ENABLED="true"
CSP_ENABLED="true"
CSP_REPORT_ONLY="false"
TRUSTED_ORIGINS="https://your-app.example"
ADMIN_INGEST_SECRET="<rotated-random-secret>"
RATE_LIMIT_ENABLED="true"
RATE_LIMIT_BACKEND="memory"
LOG_RAW_INPUTS="false"
LOG_REQUEST_BODIES="false"
AUDIT_ADMIN_ACTIONS="true"
```

Never deploy with `ADMIN_INGEST_SECRET="change-me-in-production"` in production. Admin endpoints
fail closed when the placeholder secret is used with `APP_ENV=production`.

The built-in rate limiter is in-memory. It is real and useful for a single local/demo instance, but
serverless or horizontally scaled production deployments need a shared backend such as Redis or
Upstash before limits are reliable across instances.

Security headers and CSP are emitted by `middleware.ts`. The CSP permits the app itself, development
scripts in non-production, NCBI E-utilities, and HGNC. If you add analytics, CDNs, or other services,
update `lib/security/csp.ts` deliberately and test the header.

Admin endpoints:

- `GET /api/admin/status` returns safe counts and hardening booleans.
- `POST /api/admin/data/update` is protected and audit-logged but intentionally does not execute
  shell commands or long imports from a request. Run `npm run data:update` from a controlled server
  job instead.
- Send the secret as `Authorization: Bearer <ADMIN_INGEST_SECRET>`.
- Do not put admin secrets in URLs, localStorage, browser bookmarks, logs, screenshots, or
  `NEXT_PUBLIC_*` variables.

Post-deploy checks:

```bash
curl -I https://your-app.example/
curl -i https://your-app.example/api/admin/status
curl -i https://your-app.example/api/admin/status \
  -H "Authorization: Bearer $ADMIN_INGEST_SECRET"
curl -i https://your-app.example/robots.txt
```

Expected: security headers and CSP are present, unauthenticated admin access returns a safe 401,
authenticated admin status contains no secrets or database URLs, and robots disallows `/api/` and
`/admin/`.

## Phase 10 licensed GeneCards import deployment

Keep these defaults unless the deployment has confirmed GeneCards/GeneALaCart licensing:

```env
GENE_CARDS_LINKOUT_ENABLED="true"
GENE_CARDS_LICENSED_IMPORT_ENABLED="false"
GENE_CARDS_IMPORT_MAX_BYTES="5242880"
GENE_CARDS_IMPORT_ALLOWED_EXTENSIONS=".csv,.tsv"
GENE_CARDS_IMPORT_REQUIRE_LICENSE_CONFIRMATION="true"
GENE_CARDS_IMPORT_STORE_RAW_FIELDS="true"
GENE_CARDS_IMPORT_MAX_ROWS="50000"
GENE_CARDS_IMPORT_ADMIN_ONLY="true"
```

To enable import, set `GENE_CARDS_LICENSED_IMPORT_ENABLED="true"` in the server environment only
after confirming license rights. The import endpoint is `POST /api/import/genecards`, uses the
admin bearer secret, accepts only uploaded CSV/TSV multipart files, and rejects remote URL import.
Do not add browser scraping, batch querying, public GeneCards page fetches, or automated downloads.

Back up the database before importing licensed data and include licensed tables in retention,
deletion, access-control, and restore procedures. Treat imported files as operator-controlled
licensed data, not public reference data. Test with the synthetic fixtures only unless a licensed
admin supplies real export data outside source control.

## Production gate

Before accepting real case input, add backup/restore automation, retention/deletion jobs, shared
production rate limiting, health/readiness monitoring, access controls, and a threat/privacy review.

## Phase 11 deployment and release guide

### Overview

The app supports SQLite for local/demo development and PostgreSQL for production. Deployment targets
are configured with `DEPLOYMENT_TARGET` (`local`, `codespaces`, `docker`, `vercel`, `railway`,
`render`, or another descriptive value). `npm run deploy:check` reports production warnings without
printing secret values.

### Local and Codespaces

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run data:seed
npm run data:build-hpo
npm run dev
```

Codespaces should forward port 3000 or the `PORT` you choose. The default admin secret is for local
development only. If HPO raw files are absent, `data:build-hpo` imports bundled synthetic fixtures.

### Docker Compose

```bash
cp .env.docker.example .env.docker
# edit .env.docker and replace ADMIN_INGEST_SECRET
npm run docker:build
npm run docker:up
SMOKE_BASE_URL=http://localhost:3000 npm run smoke:api
npm run docker:down
```

Compose starts `postgres` with a persistent `postgres-data` volume, runs the `migrate` service to
apply PostgreSQL migrations plus seed/HPO fixture import, and then starts the `app` container with
GeneCards licensed import disabled. It does not run destructive resets automatically. The Docker
image must be generated with `npm run db:generate:postgres`; generating it with the SQLite schema can
produce `URL must start with the protocol file:` during health checks.

### Vercel

Use Vercel for the Next.js app only with a managed PostgreSQL database. Do not use SQLite on Vercel
production. Set at least:

```env
APP_ENV="production"
NODE_ENV="production"
DEPLOYMENT_TARGET="vercel"
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
NEXT_PUBLIC_APP_URL="https://your-app.vercel.app"
ADMIN_INGEST_SECRET="<rotated-secret>"
DISABLE_LLM="true"
GENE_CARDS_LICENSED_IMPORT_ENABLED="false"
LOG_RAW_INPUTS="false"
LOG_REQUEST_BODIES="false"
```

Run Prisma migrations from a trusted workstation, CI job, or database migration job before routing
traffic. Do not run long HPO imports inside serverless requests. PubMed/HGNC outbound requests are
optional runtime calls; CI and smoke tests do not require them by default. Memory rate limiting is
per serverless instance; use a shared backend before public production traffic.

### Railway and Render

Create a Node service and a PostgreSQL database. Configure build command `npm ci && npm run build`
and start command `npm run start` or the platform equivalent. Set `APP_ENV=production`,
`DEPLOYMENT_TARGET=railway` or `render`, PostgreSQL `DATABASE_URL`/`DIRECT_URL`, a rotated
`ADMIN_INGEST_SECRET`, and privacy-safe logging defaults.

After provisioning:

```bash
npm run db:generate:postgres
npm run db:migrate:prod
npm run data:seed
npm run data:build-hpo
SMOKE_BASE_URL=https://your-app.example npm run smoke:api
```

Use the platform health check path `/api/health`. Keep database backups enabled before migrations
and HPO/licensed-data imports.

### Migration and data workflow

SQLite local:

```bash
npm run db:generate
npm run db:migrate
npm run data:seed
npm run data:build-hpo
```

PostgreSQL production:

```bash
npm run db:generate:postgres
npm run db:migrate:prod
npm run data:seed
npm run data:build-hpo
```

For full HPO updates, run `npm run data:download-hpo` and `npm run data:update` from a controlled
CLI environment against the intended database. Back up first. Do not run destructive resets or long
imports automatically during web request handling.

### Smoke tests and release

`npm run smoke:api` checks `/`, `/api/health`, `/api/data/version`,
`/api/phenotype/extract`, and `/api/prioritize` without live PubMed/HGNC/LLM requirements. Set
`SMOKE_INCLUDE_NETWORK_TESTS=true` only when outbound services are expected.

Before release:

```bash
npm run verify:full
npm run release:check
npm run docker:build
```

Use [docs/RELEASE_CHECKLIST.md](./docs/RELEASE_CHECKLIST.md) for the full rollout and rollback
sequence.

For release-candidate packaging, also review
[docs/FINAL_AUDIT.md](./docs/FINAL_AUDIT.md),
[docs/RELEASE_NOTES.md](./docs/RELEASE_NOTES.md), and
[docs/RELEASE_CANDIDATE_CHECKLIST.md](./docs/RELEASE_CANDIDATE_CHECKLIST.md).

### Troubleshooting

See [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) for SQLite lock cleanup, missing `.env`,
HPO fixture fallback, port conflicts, Docker Compose notes, and production warning interpretation.

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
