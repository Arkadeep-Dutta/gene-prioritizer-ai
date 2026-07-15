# Privacy

## Phase 6 behavior

The application has no accounts, analytics, or raw clinical-text storage. Phase 6 adds bounded
free-text phenotype extraction, but the extraction route does not persist submitted text. Local
deterministic mode maps text to HPO candidates using the local database and avoids third-party text
transmission. Optional external LLM extraction is disabled by default and requires explicit request
and environment opt-in.

Full HPO import uses approved public downloads only when `npm run data:update` is run by an
operator. Normal HPO search uses the local database and does not send user queries to a live HPO
API. Infrastructure logs may record technical metadata; operators are responsible for minimization,
security, access, and retention.

## Privacy-first case model

`UserCase` stores a one-way input hash, normalized HPO identifiers, optional candidate-gene JSON,
and privacy-safe metadata. `GeneRankingResult` stores rank, score, score breakdown JSON, matched
phenotype JSON, and warnings/evidence JSON. The ranking input hash includes sorted normalized HPO
IDs, sorted candidate genes, ranking mode, safe metadata, and algorithm version. It does not include
raw text. Storage defaults to:

- `privacyMode=true`
- `rawTextStored=false`
- `consentToStoreRawText=false`

Raw clinical free text is not stored by default in Phase 6. Any future opt-in behavior requires
explicit consent, redaction, purpose limitation, retention/deletion controls, and a privacy review
before it can be enabled.

If external LLM extraction is enabled in a future deployment, submitted text may be transmitted to
the configured provider. Operators must disclose that behavior, keep provider keys server-side, and
apply retention/deletion controls before use.

## PubMed literature search

Phase 7 literature search may send gene symbols and confirmed HPO labels/terms to NCBI E-utilities
when `/api/literature/search` is called or `/api/prioritize` is submitted with
`includeLiterature=true`. The literature endpoint does not accept raw clinical text, patient
narratives, uploads, identifiers, or arbitrary PubMed query strings. Free-text extraction output
must first be confirmed as HPO IDs before it can be used for ranking/literature enrichment.

Returned PubMed metadata may be cached locally in `LiteratureRecord`, and evidence links may be
stored in `LiteratureEvidence`. Stored literature data contains citation metadata and source
queries, not raw clinical notes. Operators with outbound network disabled will receive warnings or
ordinary deterministic ranking without PubMed enrichment.

## Data rule

Do not submit real patient data, protected health information, personally identifiable information,
or confidential case details in any environment. Development and testing use synthetic and public
reference fixtures only. The seed and HPO fixtures contain no patient case or clinical narrative.

Before a later phase changes data handling, document its purpose, fields, retention, deletion,
processors, access controls, and deployment responsibilities. Privacy review is required before
telemetry, accounts, raw-text persistence, or third-party AI services.

## Phase 8 browser and export privacy

The workflow UI keeps state in React memory only; it does not store raw clinical text in
localStorage or sessionStorage by default. Users are warned not to enter identifiable patient
information unless the app is deployed in a compliant environment.

JSON, CSV, and Markdown exports exclude raw clinical text by default and include a research-use
disclaimer. If future phases add optional raw-text export, it must require explicit user opt-in.

## Phase 9 logging, admin, and rate-limit privacy

Phase 9 keeps privacy-first defaults:

- `LOG_RAW_INPUTS=false`
- `LOG_REQUEST_BODIES=false`
- `PRIVACY_MODE_DEFAULT=true`
- `AUDIT_ADMIN_ACTIONS=true`

Audit logs are for security-sensitive admin activity. They store event type, actor type, hashed
actor/network identifiers, sanitized user agent, request ID, timestamp, and redacted metadata. They
must not store admin secrets, API keys, database URLs, Authorization headers, cookies, raw phenotype
text, raw request bodies, or clinical notes.

Third-party service boundaries:

- HGNC receives gene symbols only when server-side validation is requested and a live lookup is
  needed.
- NCBI PubMed receives gene symbols and confirmed HPO IDs/labels only when literature search is
  enabled/requested.
- External LLM providers receive text only if both the server environment and request explicitly
  enable that path; it remains disabled by default.

The app is not HIPAA-compliant by default. Operators are responsible for access controls, retention,
deletion, backups, incident response, vendor review, and compliance work before any real patient or
identifiable data is used.

## Phase 10 licensed GeneCards import privacy

Licensed GeneCards/GeneALaCart imports should contain gene annotation export data only, not patient
data, clinical narratives, identifiers, or free text. The parser excludes and warns on
patient-identifying column names such as patient, name, DOB/date of birth, MRN, email, phone, and
address.

The upload workflow stores import metadata, row counts, hashes, parser warnings, and annotation
field JSON in licensed tables. It does not store admin secrets, raw request bodies in audit logs,
raw uploaded file text in audit logs, or raw uploader IPs. Audit actor/network identifiers are
hashed through the existing redaction helpers.

Operators are responsible for license scope, retention, deletion, database backups, and access
controls for licensed imported data. Do not commit real GeneCards exports or patient-containing
files to source control.

## Phase 11 deployment privacy

Deployment operators are responsible for hosting-provider review, database backup retention,
access controls, log retention, incident response, and deletion workflows. Keep
`LOG_RAW_INPUTS=false` and `LOG_REQUEST_BODIES=false`; deployment checks warn if either is enabled
in production.

Docker and CI ignore local `.env` files, SQLite databases, logs, and raw HPO caches. Smoke tests
check API responses for secret-like text. Public health and data-version endpoints expose safe
booleans/counts/metadata only, not credentials, raw clinical text, or request bodies.

## Logres Privacy Foundation

The initial Logres/Genemed platform does not accept identifiable patient data. Synthetic demo and research workflows must avoid names, contact details, medical record numbers, dates of birth, provider tokens, and raw phenotype persistence by default.
