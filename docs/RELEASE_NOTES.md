# Release Notes

## Version

`0.1.0-rc`

Release date: TBD

## Classification

Gene Prioritizer AI is a deployment-ready research/demo release candidate. It is not a medical
device, not a diagnostic system, not clinically validated, and not HIPAA-compliant by default.

## Highlights

- Deterministic HPO-to-gene prioritization with candidate-gene support.
- Local HPO ontology and gene association service.
- HGNC nomenclature validation and safe external gene linkouts.
- Free-text phenotype extraction with confirmation before ranking.
- Optional PubMed citation metadata support through NCBI E-utilities.
- End-to-end workflow UI, gene detail views, JSON/CSV/Markdown export.
- Security headers, CSP, rate limiting, admin protection, audit logs, robots/noindex.
- Disabled-by-default licensed GeneCards/GeneALaCart admin CSV/TSV import with no scraping.
- Docker/Compose config, CI workflow, deployment env checks, smoke tests, release scripts.

## Security Controls

- No secrets in client bundle or committed env templates.
- Admin endpoints fail closed in production with the default admin secret.
- Public APIs use safe envelopes and avoid stack traces.
- Raw clinical text is not stored by default.
- File upload import is admin-only, feature-flagged, license-gated, size/row limited, and audited.

## Data Sources

- HPO ontology and HPO gene associations
- HGNC nomenclature data
- NCBI PubMed E-utilities citation metadata
- Optional user-provided licensed GeneCards/GeneALaCart CSV/TSV annotations

No OMIM ingestion, ClinVar ingestion, VCF analysis, Exomiser integration, GeneCards scraping, PubMed
HTML scraping, PDF scraping, or model training pipeline is included.

## Upgrade and Deployment Notes

Run the full verification and release checks before deploying:

```bash
npm run verify:full
npm run release:check
npm run deploy:check
```

Production should use PostgreSQL. SQLite is for local/demo development. Run migrations and HPO data
updates from a trusted CLI/CI/admin environment, not long-running public requests.

Docker build and Compose smoke may only be marked verified when Docker is available and the commands
actually pass.
