# Gene Prioritizer AI

Gene Prioritizer AI is a research-use foundation for transparent, deterministic
phenotype-to-gene prioritization with optional AI assistance. The repository currently contains
Phases 0-8: architecture, runnable web foundation, Prisma persistence, local HPO ontology/data
ingestion, HGNC-backed gene symbol validation, deterministic HPO-to-gene ranking, and free-text
phenotype extraction with HPO confirmation support, optional PubMed citation enrichment, and a
polished end-to-end workflow UI with JSON/CSV/Markdown exports.

It does **not** diagnose, scrape PubMed HTML, scrape GeneCards, fabricate citations, or claim
calibrated diagnostic probabilities. Gene validation is nomenclature validation only; extracted HPO
terms are suggestions that require confirmation; PubMed citations come from NCBI E-utilities or
test fixtures; ranking scores are transparent prioritization scores for review.

> **Research and education only.** This software is not a medical device and does not provide
> diagnosis, treatment, or clinical advice. Do not enter identifiable or real patient data. See
> [DISCLAIMER.md](./DISCLAIMER.md) and [PRIVACY.md](./PRIVACY.md).

## Quick start with SQLite

Requirements: Node.js 20.9 or newer and npm.

```bash
cp .env.example .env
npm install
npm run setup
npm run dev
```

Open <http://localhost:3000>. The health endpoint is <http://localhost:3000/api/health>.
`npm run setup` generates the Prisma client, applies local migrations, and loads synthetic seed
data. It does not require network access.

## Phase 3 HPO ingestion

Phase 3 adds a local HPO data service:

- downloads approved public HPO files into `HPO_DATA_DIR`;
- parses `hp.obo`, `phenotype_to_genes.txt`, and `genes_to_phenotype.txt`;
- imports terms, synonyms, `is_a` relationships, genes, and gene-phenotype associations into
  Prisma;
- supports `HPO_ASSOCIATION_IMPORT_LIMIT` for development checks that use full public downloads
  without loading every association row into a small SQLite database;
- records checksums and provenance in `DataSourceVersion`;
- serves local HPO search and term-detail API routes; and
- uses fixture data in tests, with no network dependency.

Full HPO data update:

```bash
npm run data:download-hpo
npm run data:build-hpo
```

Or run both safely:

```bash
npm run data:update
```

Downloaded files are cached under `./data/hpo/raw/` by default and are intentionally ignored by
Git because they are reproducible from official public HPO downloads.
The example environment caps association import for local/Codespaces SQLite verification; set
`HPO_ASSOCIATION_IMPORT_LIMIT=""` for a full production import.

## Local HPO API examples

```bash
curl "http://localhost:3000/api/hpo/search?q=seizure&limit=20"
curl "http://localhost:3000/api/hpo/term/HP%3A0001250"
curl "http://localhost:3000/api/data/version"
curl "http://localhost:3000/api/health"
```

The HPO search service is local-database-first. Normal app queries do not call a live HPO API.

## Phase 4 gene validation

Phase 4 adds a server-side HGNC validation service:

- normalizes and deduplicates candidate gene symbols;
- validates approved HGNC symbols;
- resolves previous symbols and aliases when HGNC provides a canonical approved symbol;
- stores validated canonical genes in `Gene`;
- stores aliases and previous symbols in `GeneAlias`;
- uses existing validated local gene records as a cache; and
- returns `UNVALIDATED`, never `VALIDATED`, when HGNC is unavailable and no validated cache exists.

Validation statuses:

| Status                     | Meaning                                                                   |
| -------------------------- | ------------------------------------------------------------------------- |
| `VALIDATED`                | Input matched an approved HGNC symbol.                                    |
| `ALIAS_RESOLVED`           | Input matched an HGNC alias and was resolved to a canonical symbol.       |
| `PREVIOUS_SYMBOL_RESOLVED` | Input matched a previous HGNC symbol and was resolved to a canonical one. |
| `INVALID`                  | HGNC returned a clean no-match result, or input format was rejected.      |
| `UNVALIDATED`              | HGNC was unavailable; the symbol was not confirmed.                       |
| `UNKNOWN`                  | Reserved for future local states that are neither confirmed nor invalid.  |

HGNC does not require an API key for this phase. Configure optional timeout/retry/cache settings
in `.env`; tests mock HGNC and require no network.

### Gene validation API examples

```bash
curl -X POST "http://localhost:3000/api/genes/validate" \
  -H "Content-Type: application/json" \
  -d '{"genes":["SCN2A","CACNA1A","KCNQ2"]}'

curl -X POST "http://localhost:3000/api/genes/validate" \
  -H "Content-Type: application/json" \
  -d '{"genesText":"SCN2A, CACNA1A\nKCNQ2"}'

curl "http://localhost:3000/api/genes/SCN2A"
```

Gene linkouts are generated only as URLs. GeneCards remains linkout-only; this project does not
fetch, scrape, parse, mirror, or bundle GeneCards content.

## Phase 5 deterministic ranking

Phase 5 adds a local, deterministic `/api/prioritize` endpoint. It accepts confirmed HPO IDs plus
optional candidate genes, validates them against the local HPO/gene database, retrieves local
gene-phenotype associations, and returns ranked genes with score breakdowns and matched
phenotypes. It works with `DISABLE_LLM=true` and does not require external network access for the
core ranking path.

Supported ranking modes:

| Mode                | Behavior                                                               |
| ------------------- | ---------------------------------------------------------------------- |
| `ALL_GENES`         | Rank all locally associated genes matching the submitted HPO terms.    |
| `CANDIDATE_ONLY`    | Return only supplied candidate genes; no-match candidates are shown.   |
| `CANDIDATE_BOOSTED` | Rank associated genes and apply a modest transparent candidate boost.  |
| `DISCOVERY`         | Rank associated genes outside the candidate list for discovery review. |

Example:

```bash
curl -X POST "http://localhost:3000/api/prioritize" \
  -H "Content-Type: application/json" \
  -d '{
    "hpoTerms": ["HP:0001250", "HP:0001263"],
    "candidateGenes": ["SCN2A", "CACNA1A", "KCNQ2"],
    "rankingMode": "CANDIDATE_BOOSTED",
    "limit": 10,
    "storeResults": false,
    "privacyMode": true
  }'
```

Scores are normalized to 0-100 and include `exactHpoMatch`, `ancestorHpoMatch`,
`specificityWeight`, `evidenceWeight`, `candidateBoost`, `literatureBoost`, and `penalties`. They
are prioritization scores, not probabilities. `literatureBoost` is `0` unless
`includeLiterature=true`, and even then it is capped and cannot replace the HPO-based score. If
`storeResults=true`, the app stores normalized HPO IDs, candidate genes, privacy-safe metadata,
score JSON, and matched phenotype JSON in `UserCase`/`GeneRankingResult`. Raw clinical text is not
accepted or stored.

## Phase 6 free-text phenotype extraction

Phase 6 adds `/api/phenotype/extract`. It accepts bounded free text, detects candidate phenotype
phrases, maps them to local HPO labels/synonyms, groups present/negated/uncertain/family-history
mentions, and returns `confirmedHpoTermsForRanking` for terms that still require user confirmation.
It does not automatically rank from unconfirmed free text.

Deterministic mode is the default and requires no network or LLM keys:

```bash
curl -X POST "http://localhost:3000/api/phenotype/extract" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Infant with seizures, global developmental delay, hypotonia, and feeding difficulty. No microcephaly. Family history of cardiomyopathy in the father.",
    "useLLM": false,
    "includeNegated": true,
    "includeUncertain": true,
    "includeFamilyHistory": true,
    "maxTerms": 50
  }'
```

Optional LLM extraction is scaffolded behind server-side configuration only. `DISABLE_LLM=true` and
`PHENOTYPE_ALLOW_EXTERNAL_LLM=false` are safe defaults. LLM output is schema-validated and mapped
back to local HPO records; unverified HPO IDs are not passed through to ranking. Do not submit real
patient data.

## Phase 7 PubMed literature evidence

Phase 7 adds a server-side PubMed evidence service using NCBI E-utilities (`ESearch`, `ESummary`,
and optional `EFetch` for abstracts). It searches only with gene symbols and confirmed HPO
labels/IDs; it does not accept raw clinical notes or arbitrary public PubMed queries.

Literature search endpoint:

```bash
curl -X POST "http://localhost:3000/api/literature/search" \
  -H "Content-Type: application/json" \
  -d '{
    "geneSymbol": "SCN2A",
    "hpoTerms": ["HP:0001250"],
    "retmax": 5,
    "includeAbstracts": true,
    "summarize": false
  }'
```

Multiple-gene form:

```json
{
  "geneSymbols": ["SCN2A", "KCNQ2"],
  "hpoTerms": ["HP:0001250"],
  "retmax": 5,
  "includeAbstracts": false,
  "summarize": false
}
```

Ranking can request citation enrichment without making PubMed required:

```json
{
  "hpoTerms": ["HP:0001250", "HP:0001263"],
  "candidateGenes": ["SCN2A", "CACNA1A", "KCNQ2"],
  "rankingMode": "CANDIDATE_BOOSTED",
  "storeResults": false,
  "includeLiterature": true,
  "literatureRetmax": 3,
  "literatureSummaries": false
}
```

The response includes transparent queries, PMIDs, titles, journals, publication years, authors,
DOIs, PubMed URLs, optional abstracts, and warnings. Publication count is not proof of causality,
and absence of PubMed results does not rule out a gene. Literature search works without an LLM; LLM
summaries are disabled by default and return a warning rather than fabricated claims.

## Phase 8 workflow UI and report export

Phase 8 turns the existing API foundation into the main web workflow at `/`:

```text
Input -> Extract/Validate HPO -> Confirm HPO terms -> Candidate genes/settings -> Prioritize -> Review results -> Export
```

The UI supports direct HPO code entry, free-text phenotype extraction, manual HPO confirmation,
candidate gene validation, ranking mode selection, optional PubMed evidence, transparent ranking
results, gene detail review, and client-side JSON, CSV, and Markdown report export.

Important UI safety behavior:

- extracted free-text HPO terms are suggestions and are not ranked until the user confirms them;
- present phenotypes are selected by default, while negated, uncertain, family-history-only, and
  unmapped phrases are excluded by default;
- candidate gene validation confirms nomenclature only and does not imply disease causality;
- PubMed evidence is optional, citation-linked, and labelled as non-causal support;
- exports include disclaimers and exclude raw free text by default; and
- the homepage, reports, and result views state that the app is not a diagnosis.

Informational pages are available at `/about`, `/methodology`, `/data-sources`, `/disclaimer`,
`/privacy`, and `/security`.

## Prisma commands

```bash
npm run db:generate
npm run db:migrate
npm run db:migrate:deploy
npm run db:studio
npm run data:seed
```

For PostgreSQL deployment, use the commands and migration notes in [DEPLOYMENT.md](./DEPLOYMENT.md).
Never commit `.env` or real credentials.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
npm audit --audit-level=moderate
```

Tests create and remove an isolated SQLite database, seed it deterministically, import tiny HPO
fixtures, and require no external network.

## Documentation

- [Architecture contract](./docs/ARCHITECTURE.md)
- [Deployment](./DEPLOYMENT.md)
- [Data sources](./DATA_SOURCES.md)
- [Security](./SECURITY.md)
- [Privacy](./PRIVACY.md)
- [Disclaimer](./DISCLAIMER.md)
