# Data Sources

Gene Prioritizer AI tracks source provenance in `DataSourceVersion`. Phase 7 supports public HPO
ontology/gene-association files, HGNC gene nomenclature validation, deterministic ranking over
local records, free-text extraction mapped back to local HPO data, and optional NCBI PubMed
metadata retrieval.

## Current sources

| Purpose                  | Source                                 | Access model                         | Rule                                                         |
| ------------------------ | -------------------------------------- | ------------------------------------ | ------------------------------------------------------------ |
| Synthetic fixture        | Repository-owned fixture seed          | Local seed/test only                 | No patient, literature, or proprietary content.              |
| HPO ontology             | `hp.obo` via OBO Library PURL          | Approved direct download/local cache | Store IDs, labels, definitions, synonyms, obsolescence.      |
| HPO gene associations    | HPO GitHub release TSV files           | Approved direct download/local cache | Store public association metadata without diagnostic claims. |
| Gene identity validation | HGNC REST API                          | Live server-side lookup/local cache  | Validate nomenclature; never fail open.                      |
| Deterministic ranking    | Local HPO/HGNC-derived database rows   | Local database only                  | Transparent scores; no LLM or PubMed boost required.         |
| Phenotype extraction     | Local HPO labels and synonyms          | Local database by default            | Suggestions only; confirmation required.                     |
| Optional LLM assistance  | Configured server-side provider        | Disabled by default                  | Not source of truth; local HPO verification required.        |
| Literature               | NCBI PubMed E-utilities                | Server-side live query/local cache   | Citation metadata only; no HTML, journal, or PDF scraping.   |
| GeneCards                | GeneCards linkout/licensed import only | Linkout; no scraping                 | No scraping, mirroring, or bundled proprietary data.         |

## Approved Phase 3 HPO files

- `https://purl.obolibrary.org/obo/hp.obo`
- `https://github.com/obophenotype/human-phenotype-ontology/releases/latest/download/phenotype_to_genes.txt`
- `https://github.com/obophenotype/human-phenotype-ontology/releases/latest/download/genes_to_phenotype.txt`

The download script refuses unapproved URLs. Raw downloads are cached in `HPO_DATA_DIR/raw`, and a
download manifest with SHA-256 hashes is written to `HPO_DATA_DIR/metadata`.

For small development databases, `HPO_ASSOCIATION_IMPORT_LIMIT` can cap how many public HPO
gene-association rows are imported. When set, import metadata records the available association
count, imported count, skipped count, and configured cap. Leave it empty for an uncapped import.

## Import provenance

The importer records:

- source name and type;
- checksum-derived version;
- file names and hashes;
- imported term/synonym/relationship/gene/association counts;
- import timestamps; and
- parser warnings.

The import is idempotent and non-destructive by default. It does not wipe unrelated data.

## HGNC validation

Phase 4 uses the HGNC REST API at `https://rest.genenames.org` by default. Fields used include:

- approved symbol;
- HGNC ID;
- gene name;
- alias symbols;
- previous symbols;
- Ensembl gene ID; and
- Entrez/NCBI Gene ID.

HGNC requires no API key for this phase. Live HGNC lookups are server-side only, use JSON request
headers, and are timeout/retry bounded. If HGNC is unavailable or returns a malformed response,
validation returns `UNVALIDATED`, not `VALIDATED`, unless an existing validated local cache record
can be returned with a warning.

GeneCards remains linkout-only. The app generates a user-clickable URL from a symbol when
`GENE_CARDS_LINKOUT_ENABLED=true`; it does not fetch, scrape, parse, store, or train on GeneCards
content.

## PubMed literature evidence

Phase 7 uses NCBI E-utilities for PubMed metadata:

- `ESearch` searches PubMed IDs for sanitized gene/phenotype queries.
- `ESummary` retrieves title, journal, publication date/year, authors, article IDs, and DOI when
  supplied by NCBI.
- `EFetch` can retrieve PubMed XML details such as abstracts when `includeAbstracts=true`.

Stored fields include PMID, DOI, title, abstract when requested, journal, publication year, author
list JSON, PubMed URL, source name, and fetch time. Records are upserted by PMID in
`LiteratureRecord`; `LiteratureEvidence` links records to known genes, HPO terms, and source
queries. A small in-memory query cache avoids repeated ESearch calls in the running process, and
`LiteratureRecord` acts as the durable metadata cache. Production deployments that need cross-node
query caching should add a dedicated cache in a later phase.

The literature module does not scrape PubMed HTML, scrape journal websites, download PDFs, ingest
PMC full text, scrape GeneCards, or infer causality from publication counts. Citations must come
from live NCBI responses or offline test fixtures.

## Ranking source model

The Phase 5 ranking engine uses only confirmed HPO IDs, locally stored phenotype terms, local
gene-phenotype association rows, and locally cached gene records. It does not call an LLM,
GeneCards, OMIM, ClinVar, STRING, or HGNC during the core ranking request. PubMed is optional only
when `includeLiterature=true`; failure to reach NCBI returns the ranking with warnings instead of
failing the request.

## Phenotype extraction source model

The Phase 6 deterministic extractor uses local HPO labels and synonyms. Optional LLM extraction can
suggest phrases/statuses only when explicitly enabled; all proposed IDs are verified against the
local HPO database before appearing as mapped terms. Raw clinical text is not sent to PubMed.

## Attribution and update cadence

HPO data is public reference data from the Human Phenotype Ontology project. Production operators
should review HPO release notes and update cadence, then run `npm run data:update` from a trusted
environment after migrations.

## Phase 8 UI display

The workflow UI displays HPO, HGNC, PubMed/NCBI, and local count/status information through
`/api/health` and `/api/data/version`. It also exposes safe linkouts for HGNC, NCBI Gene, ClinVar
search, PubMed search, and GeneCards linkout-only behavior when configured.

The UI does not scrape GeneCards, does not fetch PubMed HTML, and does not fabricate citations.

## Phase 9 hardening impact

Security hardening does not add biomedical sources. It adds rate limits, request size limits,
admin protection, audit logging, robots rules, and safer API responses around the existing HPO,
HGNC, PubMed/NCBI, and linkout-only GeneCards behavior.

No GeneCards scraping, PubMed scraping, OMIM ingestion, ClinVar ingestion, VCF analysis, Exomiser
integration, or real patient data ingestion is added by Phase 9.

## Phase 10 GeneCards/GeneALaCart licensed imports

GeneCards is still linkout-only by default. Linkouts are generated locally from sanitized symbols
when `GENE_CARDS_LINKOUT_ENABLED=true`; no network request is made.

Optional licensed import accepts only admin-uploaded GeneCards/GeneALaCart CSV/TSV exports when
`GENE_CARDS_LICENSED_IMPORT_ENABLED=true` and the admin confirms license permission at upload time.
The app does not scrape, crawl, fetch, parse, mirror, batch-query, or download public GeneCards web
pages, and it does not train on GeneCards content.

Imported annotations are stored in `LicensedGeneCardsImport` and
`LicensedGeneCardsGeneAnnotation`, separate from HPO, HGNC, and PubMed evidence. Gene detail views
and JSON/CSV/Markdown exports may show labeled licensed annotations when present, but they are not
diagnostic evidence and do not change deterministic ranking scores.

## Phase 11 deployment data operations

Local and CI verification can run entirely on bundled synthetic HPO fixtures. Production data
updates should run from trusted CLI jobs:

```bash
npm run data:download-hpo
npm run data:update
```

HGNC validation and PubMed literature search remain optional outbound services. Missing API keys do
not block local deployment. GeneCards licensed import remains disabled by default and must not be
enabled unless the deployment has license rights and retention controls.
