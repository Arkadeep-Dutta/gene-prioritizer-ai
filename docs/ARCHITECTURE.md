# Architecture Contract

Status: accepted foundation contract through Phase 9. Later changes require documentation, tests,
and a clear migration path.

## 1. High-level architecture

Gene Prioritizer AI is a modular Next.js application with strict boundaries between presentation,
validated API routes, deterministic biomedical services, versioned local reference data, and future
optional external adapters.

```text
Browser / App Router UI
        |
Validated API routes
        |
Application services
   |                |              |              |
HPO service   Phenotype extraction   Ranking core   Report builder
   |                |
Prisma DB with versioned reference data
```

The phenotype extraction service can use deterministic local matching and optional server-only LLM
assistance when explicitly enabled. All extracted HPO candidates must be verified against the local
database before they can be proposed for confirmation. The ranking core remains deterministic,
versioned, explainable, and testable without a network or an LLM. External adapters may add
suggestions or evidence in later phases but cannot silently alter deterministic scoring.

## 2. Planned folder structure

```text
app/                 App Router pages, layouts, and API routes
components/          Accessible presentational and workflow components
lib/
  api/               Shared API envelope helpers
  db/                Prisma client and environment validation
  hpo/               Phase 3 HPO parsing, import, repository, and search
  genes/             Phase 4 gene normalization, HGNC validation, cache, and linkouts
  ranking/           Phase 5 deterministic scoring and explanations
  phenotype/         Phase 6 free-text extraction and HPO candidate mapping
  literature/        Phase 7 PubMed query, NCBI client, parser, cache, and evidence storage
  security/          Phase 9 headers, CSP, rate limits, admin auth, audit, and redaction
  llm/               Optional disabled-by-default LLM provider interfaces
  integrations/      Future external adapters
data/
  hpo/raw/           Ignored HPO downloaded source files
  hpo/metadata/      Ignored download manifests and hashes
docs/                Architecture and operating documentation
scripts/             Setup, ingestion, migration, and maintenance commands
tests/               Integration, contract, fixtures, and end-to-end tests
public/              Static public assets only
```

Directories are created only when their phase owns real code.

## 3. Data flow

Planned user workflow:

```text
free text -> HPO extraction -> HPO confirmation -> gene associations -> ranking -> literature -> report
```

Current Phase 6 phenotype extraction flow:

```text
free text -> safety/input validation -> deterministic/optional LLM extraction -> local HPO verification -> grouped HPO candidates -> user confirmation -> existing /api/prioritize
```

Current Phase 3 reference-data flow:

```text
HPO public files -> local cache -> parser -> Prisma DB -> local search/repository -> API -> future ranking engine
```

Normal HPO search and term detail requests read from the local database. They do not call a live
HPO API during normal app use.

Current Phase 4 candidate-gene validation flow:

```text
candidate gene input -> normalization -> local DB cache -> HGNC validation -> canonical Gene/GeneAlias storage -> safe linkouts -> future ranking
```

Current Phase 5 deterministic ranking flow:

```text
confirmed HPO terms -> local HPO validation -> candidate gene validation -> gene-phenotype associations -> deterministic scoring -> ranked genes -> optional persistence
```

Ranking stores only normalized IDs, candidate symbols, privacy-safe metadata, score breakdowns, and
matched phenotype evidence when `storeResults=true`. It does not accept raw clinical text.

Current Phase 6 extraction does not store raw clinical text by default. Present, negated, uncertain,
family-history-only, and unmapped candidates are separated so only user-confirmed present HPO terms
flow into the existing deterministic ranking API.

Current Phase 7 literature flow:

```text
ranked genes + confirmed HPO terms -> PubMed query builder -> NCBI E-utilities -> metadata parser -> LiteratureRecord/LiteratureEvidence -> citation-grounded result enrichment
```

PubMed enrichment is optional and bounded. It uses gene symbols and confirmed HPO IDs/labels only,
does not accept raw clinical text, does not expose arbitrary PubMed query syntax publicly, and does
not scrape PubMed HTML, journals, PDFs, or GeneCards.

Current Phase 8 UI workflow:

```text
user input -> frontend validation -> extraction/validation APIs -> confirmation -> prioritization API -> results/evidence -> export/report
```

The browser UI is a React/App Router layer over existing APIs. It keeps raw free text in memory
only, requires HPO confirmation before ranking, displays score limitations and data status, and
generates JSON/CSV/Markdown exports that exclude raw text by default.

Current Phase 9 security flow:

```text
request -> middleware/security headers -> rate limit -> request size/JSON validation -> service layer -> privacy-safe persistence/audit -> safe response envelope
```

Current admin flow:

```text
admin request -> secret verification -> rate limit -> audit log -> safe status/deferred update response
```

## 4. Safety model

- Research and educational use only; no diagnosis, treatment, or clinical decision support.
- No real patient data in UI, fixtures, logs, prompts, or reports.
- Human confirmation is mandatory between future extraction and ranking.
- LLM output is untrusted, optional, provenance-labelled, schema-validated, and never sole ranking
  evidence.
- Free-text extraction is a suggestion step only. Extracted HPO terms require user review and
  confirmation before ranking.
- Deterministic ranking must expose inputs, algorithm version, contributions, ties, and limitations.
- Results must never claim disease causality, certainty, completeness, or professional endorsement.
- Inputs are bounded and validated; outbound calls are allowlisted, time-limited, and secret-safe.
- GeneCards is linkout/licensed import only. No scraping or automated content extraction.
- PubMed citations must come from NCBI E-utilities responses or test fixtures; LLMs may not invent
  PMIDs, titles, journals, authors, or claims.
- Literature counts can add only a modest capped boost and never replace deterministic HPO ranking.
- Security controls must never imply diagnosis, HIPAA compliance, or clinical deployment readiness.
- Admin requests must not execute arbitrary shell commands or accept arbitrary file paths.

## 5. Data source model

Local biomedical releases are immutable, checksum-tracked inputs to reproducible transformation
jobs. Generated records carry source name, source type, retrieval/import time, checksum-derived
version, and import metadata in `DataSourceVersion`.

Phase 3 supports:

- `hp.obo` ontology terms, labels, definitions, synonyms, obsolete flags, replacements, alt IDs,
  and `is_a` relationships;
- `phenotype_to_genes.txt`; and
- `genes_to_phenotype.txt`.

Phase 4 validates HGNC nomenclature. Phase 5 ranks genes deterministically from local
gene-phenotype associations. Phase 6 maps free text to local HPO candidates using local labels and
synonyms, with optional schema-validated LLM assistance that is disabled by default and is not a
source of truth. Phase 7 retrieves PubMed citation metadata through NCBI E-utilities only and
stores records idempotently by PMID. Phases 4-7 do not scrape GeneCards, store raw clinical text by
default, or require an LLM.

## 6. Deployment model

The same tested artifact targets Codespaces/local development, Docker, Vercel, Railway, and Render.
Configuration is environment-driven. Secrets live only in platform stores or uncommitted local
files. HPO imports should run as administrative jobs, not during user requests or app startup.

Recommended production order:

1. migrate database;
2. run HPO import from a trusted environment;
3. verify `/api/data/version` and `/api/health`;
4. deploy or promote the app.

## 7. Testing strategy

- Static gates: strict TypeScript, ESLint, Prettier, dependency audit.
- Unit tests: HPO ID validation, OBO parsing, TSV parsing, normalization.
- Import tests: fixture import, idempotency, source versions, duplicate handling.
- Repository tests: local search, exact HPO lookup, synonyms, obsolete terms, term/gene queries.
- Phenotype extraction tests: input validation, deterministic matching, negation, uncertainty,
  family-history handling, metadata, HPO mapping, LLM schema validation, and API privacy behavior.
- API tests: search, term detail, data version, health, validation errors, extraction, ranking, no
  secret leakage.
- Literature tests: query builder, NCBI client mocks, PubMed parser, repository/cache, evidence
  idempotency, API behavior, and optional ranking enrichment.
- Future workflow tests: reports and polished UI flows.

No test uses real patient data, paid APIs, GeneCards scraping, live PubMed calls, or live HPO
network calls.

## 8. Explicit non-goals

- No diagnosis or treatment recommendations.
- No GeneCards scraping.
- No real patient data.
- No hardcoded secrets.
- No LLM-only ranking.
- No claim of exhaustive genes, phenotypes, literature, or causal evidence.
- No autonomous clinical actions, EHR integration, or direct-to-patient interpretation.

## 9. Phase checklist

### Phase 1 — Repository foundation (complete)

- [x] Runnable Next.js App Router, TypeScript, and Tailwind landing page
- [x] Visible disclaimer and truthful capability status
- [x] ESLint, Prettier, Vitest, CI, Docker, Compose, and environment template
- [x] Architecture, deployment, security, privacy, disclaimer, and source documentation

### Phase 2 — Database and Prisma foundation (complete)

- [x] SQLite local/dev schema and PostgreSQL production schema
- [x] Prisma client workflow, migrations, synthetic seed, and real `db:*` scripts
- [x] Privacy-first persistence defaults without raw clinical text
- [x] Database health, integrity, privacy, GeneCards-safety, and CI tests

### Phase 3 — HPO data ingestion and local ontology service (complete)

- [x] Approved HPO download scripts for `hp.obo`, `phenotype_to_genes.txt`, and
      `genes_to_phenotype.txt`
- [x] OBO parser for labels, definitions, synonyms, ancestry, obsolete terms, replacements, and
      alt IDs
- [x] TSV parsers for HPO gene-association files
- [x] Idempotent import into existing Prisma models
- [x] Source version tracking with hashes, counts, and metadata
- [x] Explicit optional association import cap for small SQLite development verification
- [x] Local HPO repository/search service and API routes
- [x] Fixture-based parser, import, search, API, and security tests

### Phase 4 — Gene identity and association validation (complete)

- [x] Normalize, deduplicate, and bound candidate gene inputs
- [x] Validate approved HGNC symbols through a server-side mocked-in-test client
- [x] Resolve aliases and previous symbols to canonical HGNC symbols
- [x] Store validated canonical genes and aliases in existing Prisma models
- [x] Preserve HGNC source metadata without implying disease causality
- [x] Generate safe HGNC, NCBI, Ensembl, ClinVar, PubMed, HPO, and GeneCards linkouts
- [x] Prove HGNC failures return `UNVALIDATED`, not `VALIDATED`
- [x] Prove GeneCards remains linkout-only with no scraping

### Phase 5 — Deterministic gene prioritization (complete)

- [x] Specify and version deterministic HPO-to-gene scoring
- [x] Validate confirmed HPO IDs against the local ontology
- [x] Canonicalize candidate genes from local gene records without requiring live network calls
- [x] Support `ALL_GENES`, `CANDIDATE_ONLY`, `CANDIDATE_BOOSTED`, and `DISCOVERY`
- [x] Return score breakdowns, matched phenotypes, warnings, linkouts, and limitations
- [x] Persist privacy-safe `UserCase` and `GeneRankingResult` rows when requested
- [x] Add ranking, API, persistence, and privacy/security tests

### Phase 6 — Free-text phenotype extraction and HPO confirmation (complete)

- [x] Add deterministic local phenotype extraction from HPO labels and synonyms
- [x] Separate present, negated, uncertain, family-history-only, and unmapped candidates
- [x] Map all extracted candidates back to verified local HPO records
- [x] Add optional disabled-by-default LLM provider abstraction with strict schema validation
- [x] Require human confirmation before passing extracted HPO terms to ranking
- [x] Avoid raw free-text persistence by default and document external LLM risks
- [x] Add extraction, mapping, LLM, API, privacy, and security tests

### Phase 7 — PubMed evidence (complete)

- [x] Add NCBI-compliant server adapter with provenance, caching, and rate limits
- [x] Keep citations transparent and apply only a modest capped ranking boost when requested
- [x] Show dates, identifiers, links, limitations, and failures truthfully
- [x] Use fixture contracts and a separately controlled live smoke check

### Phase 8 — Polished workflow UI (complete)

- [x] Build accessible confirmation and ranking review screens
- [x] Add loading, empty, partial, warning, and retry states
- [x] Keep disclaimer and score limitations visible
- [x] Add JSON, CSV, and Markdown exports that exclude raw text by default
- [x] Add informational pages and data source/version status display
- [x] Add component, export, API helper, and page tests

### Phase 9 — Security hardening and workflow resilience (complete)

- [x] Add centralized security headers and Content Security Policy
- [x] Add request body limits and safe invalid JSON handling for expensive endpoints
- [x] Add configurable in-memory rate limiting for expensive and admin endpoints
- [x] Add protected admin status and deferred data update endpoints
- [x] Add audit logging with hashed identifiers and redacted metadata
- [x] Add robots/noindex protection for API/admin surfaces
- [x] Add security, admin, rate-limit, redaction, and no-secret-leakage tests
- [x] Document production limitations, including memory rate limiter scope

### Phase 10 — Report and linkouts

- [ ] Build accessible HTML/print report with methods, versions, evidence, and limitations
- [ ] Label computed, sourced, user-provided, and AI-assisted content
- [ ] Add safe PubMed and GeneCards user-clicked links; never scrape GeneCards
- [ ] Test escaping, injection resistance, snapshots, printing, and partial evidence

## Phase 10 licensed GeneCards import flow

Phase 10 adds a disabled-by-default, admin-only licensed import path:

```text
admin licensed CSV/TSV upload
  -> admin secret check
  -> feature flag check
  -> license confirmation
  -> file validation
  -> defensive parser
  -> LicensedGeneCardsImport
  -> LicensedGeneCardsGeneAnnotation
  -> optional gene detail display/export labels
```

Non-flow:

```text
No GeneCards scraping, crawling, HTML fetching, remote GeneCards download, website automation,
mirroring, model training, or diagnostic-truth promotion.
```

Imported annotations are separate from HPO/HGNC/PubMed evidence. They may link to an existing
`Gene` by symbol, but they do not validate symbols, change gene records, alter HPO associations,
or change ranking scores. API/UI/export surfaces label them as user-provided licensed data and warn
that they are not diagnostic evidence.

Admin APIs:

- `POST /api/import/genecards` imports a multipart CSV/TSV file with license confirmation.
- `GET /api/admin/genecards/imports` lists safe import metadata.
- `GET /api/admin/genecards/imports/[id]` returns import details and annotation field-name samples.

All import attempts, successes, and failures write `AuditEvent` rows with redacted metadata and no
raw uploaded file content.

## Phase 11 deployment architecture

```text
browser
  -> Next.js app/API
    -> Prisma
      -> SQLite for local/Codespaces/demo
      -> PostgreSQL for production Docker/Vercel/Railway/Render
    -> optional outbound APIs when enabled: HGNC, PubMed/NCBI, optional LLM
```

Docker Compose:

```text
app container -> postgres container -> persistent postgres-data volume
```

Vercel:

```text
Vercel Next.js serverless/runtime -> managed PostgreSQL
trusted CLI/CI job -> Prisma migrations + HPO import/update
```

Railway/Render:

```text
Node web service -> managed PostgreSQL
platform health check -> /api/health
```

Deployment checks live in `lib/deployment/env-check.ts` and are exposed through
`npm run deploy:check`, public health warning counts, and detailed admin status warnings. Build
metadata is safe and optional: `APP_VERSION`, `BUILD_COMMIT_SHA`, `BUILD_TIME`, and
`DEPLOYMENT_TARGET`.

### Phase 11 — Production hardening

- [ ] Complete threat model, privacy review, accessibility audit, and scanning
- [ ] Add health/readiness, privacy-safe observability, rate limiting, and budgets
- [ ] Document backup/restore, retention/deletion, incidents, runbooks, and rollback
- [ ] Run load, failure, migration, container, and platform deployment tests

### Phase 12 — Release validation and governance

- [ ] Validate Codespaces, Vercel, Railway, Render, and Docker from clean environments
- [ ] Pin production data/model/algorithm versions and publish limitations/change log
- [ ] Obtain independent domain, safety, security, privacy, and accessibility review
- [ ] Define update cadence, regression corpus, monitoring, and release approval checklist

No phase may be marked complete when its UI or documentation implies placeholder functionality.
