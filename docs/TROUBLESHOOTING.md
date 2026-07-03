# Troubleshooting

## SQLite Locked on Windows or Codespaces

If tests are interrupted, a stale Node/Vitest process may hold `prisma/test.db`.

```powershell
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*vitest*' }
```

Stop only the stale test process, then rerun `npm test`.

## Missing `.env`

Copy the template:

```bash
cp .env.example .env
```

Never commit `.env`.

## HPO Raw Files Missing

This is acceptable for local verification. `npm run data:build-hpo` falls back to bundled synthetic fixtures. Use `npm run data:download-hpo` and `npm run data:update` for a full data refresh.

## Port Already in Use

Set a different port:

```bash
PORT=3131 npm run dev
SMOKE_BASE_URL=http://localhost:3131 npm run smoke:api
```

## Docker Compose

Copy the Docker env template and replace the admin secret:

```bash
cp .env.docker.example .env.docker
# rotate ADMIN_INGEST_SECRET
npm run docker:build
npm run docker:up
SMOKE_BASE_URL=http://localhost:3000 npm run smoke:api
npm run docker:down
```

Compose uses PostgreSQL and runs a one-time `migrate` service before the app starts. If the health
endpoint reports `URL must start with the protocol file:` while `DATABASE_URL` is PostgreSQL, the
image was generated with the SQLite Prisma schema by mistake. Rebuild and confirm Docker uses
`npm run db:generate:postgres`. Compose does not run destructive resets automatically.

## Production Warnings

Run:

```bash
npm run deploy:check
```

Warnings intentionally avoid secret values. Errors must be fixed before production deployment.

## HPO Import Modes

Use `HPO_IMPORT_MODE=fixture` for bounded local/CI verification and `HPO_IMPORT_MODE=full` only for production or staging imports from `data/hpo/raw/`.

Fixture import:

```bash
HPO_IMPORT_MODE=fixture npm run data:build-hpo
```

Full production import:

```bash
npm run data:download-hpo
HPO_IMPORT_MODE=full npm run data:build-hpo
```

If full mode fails with missing raw files, run `npm run data:download-hpo` or place the official HPO files in `data/hpo/raw/`: `hp.obo`, `phenotype_to_genes.txt`, and `genes_to_phenotype.txt`.

If full mode fails because `HPO_ASSOCIATION_IMPORT_LIMIT` is set, unset that variable or switch to `HPO_IMPORT_MODE=fixture`. Full mode is intentionally explicit so CI cannot run the large import by default.

Check imported counts through health:

```bash
curl -s http://localhost:3000/api/health | jq '.data.data.counts'
```

These modes do not scrape GeneCards and do not add OMIM, ClinVar, VCF, Exomiser, model training, or new biomedical claims.
