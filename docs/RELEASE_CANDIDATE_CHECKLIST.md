# Release Candidate Checklist

## Verification

- [ ] `npm install`
- [ ] `npm run db:generate`
- [ ] `npm run db:migrate:deploy`
- [ ] `npm run data:seed`
- [ ] `npm run data:build-hpo`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run format:check`
- [ ] `npm audit --audit-level=moderate`
- [ ] `npm run test:e2e`
- [ ] `npm run verify`
- [ ] `npm run verify:full`
- [ ] `npm run deploy:check`
- [ ] `npm run release:check`
- [ ] `npm run smoke:api`

## Docker

- [ ] Docker available in the environment
- [ ] `npm run docker:build`
- [ ] `cp .env.docker.example .env.docker`
- [ ] `.env.docker` admin secret replaced
- [ ] `npm run docker:up`
- [ ] `SMOKE_BASE_URL=http://localhost:3000 npm run smoke:api`
- [ ] `npm run docker:down`

If Docker is unavailable, record that Docker runtime verification was not performed.

## Environment and Secrets

- [ ] No `.env` committed
- [ ] `.env.example` contains safe placeholders only
- [ ] `.env.docker.example` contains safe local placeholders only
- [ ] Production `ADMIN_INGEST_SECRET` rotated
- [ ] `DATABASE_URL` points to PostgreSQL in production
- [ ] `LOG_RAW_INPUTS=false`
- [ ] `LOG_REQUEST_BODIES=false`
- [ ] `DISABLE_LLM=true` unless separately governed
- [ ] `GENE_CARDS_LICENSED_IMPORT_ENABLED=false` unless license rights are confirmed

## Data and Migrations

- [ ] PostgreSQL backup taken before migration
- [ ] Migrations deployed from trusted CLI/CI
- [ ] HPO seed/import/update plan reviewed
- [ ] No destructive reset in production
- [ ] Licensed GeneCards import retention/deletion responsibilities reviewed

## Safety and Privacy

- [ ] Research/education scope visible
- [ ] Not medical advice and not a diagnosis visible
- [ ] Not clinically validated and not HIPAA-compliant by default documented
- [ ] No real patient data in fixtures or docs
- [ ] Exports exclude raw clinical text by default
- [ ] PubMed evidence labeled as citation support, not causality
- [ ] GeneCards remains no-scraping and licensed import only

## Deployment Review

- [ ] Local/Codespaces instructions verified
- [ ] Docker instructions reviewed
- [ ] Vercel instructions reviewed
- [ ] Railway/Render instructions reviewed
- [ ] Smoke test base URL set correctly
- [ ] `/api/health` checked
- [ ] Admin status checked with rotated admin secret
- [ ] Logs reviewed for secret/raw-text absence
