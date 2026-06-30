# Release Checklist

Use this checklist before tagging or deploying Gene Prioritizer AI.

1. Pull the latest `main`.
2. Confirm `.env.example` and `.env.docker.example` are current.
3. Confirm no `.env`, real credentials, real patient data, or real licensed GeneCards exports are staged.
4. Run `npm install`.
5. Run `npm run verify:full`.
6. Run `npm run release:check`.
7. Run `npm run docker:build`.
8. If Docker is available locally, copy `.env.docker.example` to `.env.docker`, change the admin secret, run `npm run docker:up`, run `SMOKE_BASE_URL=http://localhost:3000 npm run smoke:api`, then run `npm run docker:down`.
9. Review Prisma migrations for SQLite and PostgreSQL.
10. Back up production PostgreSQL before migration.
11. Run PostgreSQL migrations from a trusted environment with `npm run db:migrate:prod`.
12. Run HPO seed/import/update commands from a controlled CLI job, not from a public request.
13. Deploy staging.
14. Run `SMOKE_BASE_URL=<staging-url> npm run smoke:api`.
15. Confirm `/api/health` is safe and admin status requires `Authorization: Bearer <ADMIN_INGEST_SECRET>`.
16. Deploy production.
17. Run production smoke tests.
18. Monitor logs for safe errors, no raw clinical text, and no secret leakage.
19. Keep rollback artifacts and database backup references with the release notes.

Do not use this checklist to start new biomedical ingestion, VCF analysis, Exomiser, OMIM, ClinVar, or GeneCards scraping work.
