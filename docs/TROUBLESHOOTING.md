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
npm run docker:up
```

If the app starts before migrations have been applied to a fresh PostgreSQL volume, run migrations from a trusted CLI context and restart the app. Compose does not run destructive resets automatically.

## Production Warnings

Run:

```bash
npm run deploy:check
```

Warnings intentionally avoid secret values. Errors must be fixed before production deployment.
