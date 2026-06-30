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
