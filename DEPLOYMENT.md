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

```bash
docker compose up --build
```

Compose is suitable for a disposable SQLite demo. Mount persistent storage if you want to keep the
SQLite database or HPO cache between container restarts.

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

## Production gate

Before accepting case input or enabling future ranking, add rate limiting, backup/restore
automation, log redaction, retention/deletion jobs, dependency scanning, health/readiness
monitoring, and a threat/privacy review.
