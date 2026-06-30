# Final Audit

## Scope

Gene Prioritizer AI is a research/education prototype and decision-support demonstration. It is not
a medical device, not a diagnostic system, and not HIPAA-compliant by default. Production clinical
use would require additional validation, governance, compliance review, monitoring, security
review, and qualified professional oversight.

Phase 12 is final stabilization and release-candidate packaging only. No new biomedical feature,
ranking science, VCF analysis, Exomiser integration, OMIM ingestion, ClinVar ingestion, model
training, or GeneCards scraping is included.

## Completed Phases

- Phase 0: architecture contract and roadmap
- Phase 1: Next.js/TypeScript/Tailwind foundation
- Phase 2: Prisma SQLite local/dev and PostgreSQL production schema foundation
- Phase 3: HPO ingestion and local ontology service
- Phase 4: HGNC validation and safe gene linkouts
- Phase 5: deterministic HPO-to-gene ranking
- Phase 6: free-text phenotype extraction and HPO confirmation
- Phase 7: PubMed citation-grounded support through NCBI E-utilities
- Phase 8: workflow UI, gene details, and exports
- Phase 9: security headers, CSP, rate limiting, admin protection, audit logs, robots/noindex
- Phase 10: disabled-by-default licensed GeneCards/GeneALaCart admin upload import with no scraping
- Phase 11: deployment, Docker/Compose config, CI/CD, env checks, smoke tests, release docs
- Phase 12: final audit, cleanup, release notes, and release-candidate checklist

## Architecture Summary

```text
browser -> Next.js app/API -> service modules -> Prisma
                                      -> SQLite local/demo
                                      -> PostgreSQL production
                         -> optional outbound APIs: HGNC, NCBI PubMed, optional LLM
```

API routes use consistent JSON envelopes from `lib/api/response.ts`. Server routes own Prisma
access. Client components consume typed client API helpers and do not import Prisma or server-only
database modules. Admin routes require the admin bearer secret and are rate-limited.

## Verification Status

The release candidate must pass:

```bash
npm install
npm run db:generate
npm run db:migrate:deploy
npm run data:seed
npm run data:build-hpo
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
npm audit --audit-level=moderate
npm run test:e2e
npm run verify
npm run verify:full
npm run deploy:check
npm run release:check
npm run smoke:api
```

Docker runtime verification is separate. Dockerfile and Compose config are present and covered by
configuration tests, but Docker build/Compose smoke may only be claimed when Docker is available and
the commands actually run.

## Security and Privacy Review

- Security headers and CSP are applied by middleware.
- Rate limiting covers expensive public routes and admin routes.
- Admin endpoints require `Authorization: Bearer <ADMIN_INGEST_SECRET>` or `x-admin-secret`.
- Production default admin secret fails closed.
- Audit events redact sensitive metadata and do not store raw clinical text or upload bodies.
- Public health/data endpoints expose only safe metadata, booleans, counts, and warning counts.
- Detailed deployment warnings are admin-only.
- `.env`, SQLite DB files, logs, raw HPO caches, and build artifacts are ignored.
- Docker images do not copy `.env` and run as a non-root user.

## Data Source Review

HPO and HGNC are source-tracked public/reference data. PubMed support uses NCBI E-utilities
metadata and does not scrape HTML, journal pages, PDFs, or PMC full text. GeneCards is linkout-only
unless an admin explicitly imports a licensed user-provided CSV/TSV export. Imported GeneCards data
is stored separately and labeled as licensed, user-provided, non-diagnostic annotation data.

## Clinical and Legal Safety

The UI, API disclaimers, docs, and exports state that results are research/education only, not
medical advice, not a diagnosis, and not clinical probabilities. Literature evidence does not prove
causality. Absence of PubMed results does not rule out a gene. Gene validation confirms
nomenclature only and does not imply disease causality.

## Known Risks and Limitations

- Not clinically validated and not HIPAA-compliant by default.
- No user accounts, RBAC, SIEM integration, monitoring vendor, or shared production rate-limit
  backend.
- Memory rate limiting is per-process and not sufficient for multi-instance public production.
- Full HPO imports can be large and should run from trusted CLI/CI jobs.
- Docker runtime verification depends on Docker being available in the execution environment.
- Optional external LLM use remains disabled by default and requires separate governance.

## Future Roadmap

Recommended future work is governance and operations first: external security review, production
monitoring, shared rate limiting, access control, retention/deletion workflows, backup restore
drills, and formal clinical/privacy review before any clinical or patient-data use.
