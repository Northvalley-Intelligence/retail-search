# OpenSearch and Cloudflare Setup

Phase 1 uses a managed OpenSearch-compatible provider supplied through `OPENSEARCH_URL`, `OPENSEARCH_USERNAME`, and `OPENSEARCH_PASSWORD`. The provider should expose the standard OpenSearch HTTP API over HTTPS. Do not encode provider-specific assumptions into the Worker; later phases can extend the same provider by adding separate indices for Cranfield, BEIR, ESCI, and behavior data.

Recommended provider shape:

- HTTPS endpoint with the OpenSearch root, index, bulk, refresh, count, and search APIs.
- Basic authentication or API-key authentication.
- Enough storage for per-phase indices: `cranfield-v0`, future `beir-*`, future `esci-*`, and future `behavior-*`.
- Ability to create or update mappings and bulk-load public evaluation corpora.
- A read-only runtime credential for the Worker and a separate write-capable indexing credential when the provider supports credential separation.

Cost caveat: free-tier limits depend on the selected provider. Keep Phase 1 on the smallest viable managed OpenSearch plan, watch storage and request limits, and delete unused test indices/domains when no longer needed.

## Users

Prefer two OpenSearch users so the public Worker never receives indexing credentials:

- `retail_search_runtime`: read-only user used by the Cloudflare Worker.
- `retail_search_indexer`: local/operator-only user used to create indices and bulk-load corpora.

In OpenSearch Dashboards or the provider console, create roles before users when role management is available:

- `retail_search_runtime_role`
  - Index patterns: `cranfield-*`, `beir-*`, `esci-*`, `behavior-*`
  - Permissions: read/search only.
- `retail_search_indexer_role`
  - Index patterns: `cranfield-*`, `beir-*`, `esci-*`, `behavior-*`
  - Permissions: create index, write, bulk, update mappings/settings as needed for ingestion.

Then create internal users with strong generated passwords and map them to the roles above. If the provider supplies only one credential, use it locally for indexing and as the temporary runtime credential until a narrower runtime credential is available. Keep passwords in a password manager or Cloudflare/provider secrets, not in this repository.

## Environment

Worker runtime values:

```bash
CRANFIELD_INDEX=cranfield-v0
ARCHITECTURE_VERSION=v0-cranfield-opensearch-baseline
OPENSEARCH_URL=https://your-opensearch-provider.example:443
OPENSEARCH_USERNAME=retail_search_runtime
OPENSEARCH_PASSWORD=<runtime-user-password>
```

Local ingestion values when separate indexer credentials exist:

```bash
OPENSEARCH_INDEXER_USERNAME=retail_search_indexer
OPENSEARCH_INDEXER_PASSWORD=<indexer-user-password>
```

Cloudflare deployment values:

```bash
CLOUDFLARE_ACCOUNT_ID=<account-id>
CLOUDFLARE_API_TOKEN=<workers-deploy-token>
```

For Cloudflare, keep `ARCHITECTURE_VERSION` and `CRANFIELD_INDEX` as plain Worker variables. Store `OPENSEARCH_URL`, `OPENSEARCH_USERNAME`, and `OPENSEARCH_PASSWORD` as Worker secrets. Do not deploy until the token has been verified and the OpenSearch index is live.

Current Phase 1 public deployment:

```text
https://retail-search.feroshjacob.workers.dev
```

The deployed Worker uses `cranfield-v0` and exposes health, Cranfield search/explain/evaluation, v0 aliases, latest aliases, and organized public pages.

The root URL serves the project phase directory. Phase 1 details are split across focused pages:

```text
/phases/cranfield
/phases/cranfield/search
/phases/cranfield/data
/phases/cranfield/explain
/phases/cranfield/evaluation
```

Short aliases are available at `/phase-1`, `/phase-1/search`, `/phase-1/data`, `/phase-1/explain`, and `/phase-1/evaluation`.

The public pages include dataset references for Cranfield, BEIR, and Amazon ESCI. Behavioral ranking remains marked as dataset not selected until a source and privacy boundary are approved.

Dataset metadata is available at:

```text
/api/cranfield/meta
/api/datasets/cranfield
/api/dataset
```

Search explain responses include a `retrievalFlow` sequence that mirrors the public flow diagram on the Phase 1 explain page.

Evaluation results are exposed on the Phase 1 evaluation page and as JSON at:

```text
/api/cranfield/evaluation
/api/evaluation
```

## Cranfield Export

The full Cranfield corpus is reproducible from the public Glasgow test collection used by `ir_datasets` dataset id `cranfield`.

```bash
npm run export:cranfield
```

To load the exported corpus into the configured live OpenSearch provider:

```bash
npm run load:cranfield
```

The script downloads the public `cran.tar.gz`, verifies its checksum, parses:

- `cran.all.1400`
- `cran.qry`
- `cranqrel`

and writes:

- `data/cranfield/full/documents.jsonl`
- `data/cranfield/full/queries.json`
- `data/cranfield/full/qrels.jsonl`
- `experiments/cranfield-v0/cranfield-full-bulk.ndjson`

The export command is local only. `npm run load:cranfield` mutates only the configured OpenSearch index: it creates `cranfield-v0` if missing, bulk-loads the public Cranfield documents, refreshes the index, and reports counts without printing credentials.
