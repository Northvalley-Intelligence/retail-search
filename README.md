# Retail Search

Retail Search is a mission-driven OpenSearch project for discovering the simplest production-shaped retail search architecture that improves relevance while staying fast, explainable, reproducible, and deployable.

Phase 1 starts with a Cranfield baseline:

- OpenSearch index definition for Cranfield-shaped documents
- Cloudflare Worker-compatible search API
- `/api/cranfield/search?q=...`
- `/api/cranfield/explain?q=...`
- version aliases at `/api/v0/search`, `/api/v0/explain`, `/api/search`, and `/api/explain`
- public home page that lists all project phases
- focused Phase 1 pages for search, indexed-data details, Search Explain, and evaluation results
- baseline evaluation metrics for MAP, nDCG, Precision, Recall, and MRR
- architecture decision ledger

## Local Validation

```bash
npm run validate
```

The default validation run uses a fixture evaluator so the repository can be tested without downloading dependencies or requiring a live OpenSearch cluster. Phase 1 public acceptance is also verified against the deployed Cloudflare Worker and live `cranfield-v0` OpenSearch index.

## Public Site

Open the public home page:

```text
https://retail-search.feroshjacob.workers.dev
```

The home page lists the project phases. Phase 1 is split into focused pages so the search demo, indexed-data guidance, explain flow, and evaluation results do not crowd one page.

```text
/phases/cranfield
/phases/cranfield/search
/phases/cranfield/data
/phases/cranfield/explain
/phases/cranfield/evaluation
```

Short aliases are also available at `/phase-1`, `/phase-1/search`, `/phase-1/data`, `/phase-1/explain`, and `/phase-1/evaluation`.

The public pages link to the dataset sources used or planned for each phase:

- Cranfield: `https://ir.dcs.gla.ac.uk/resources/test_collections/cran/`
- BEIR: `https://github.com/beir-cellar/beir`
- Amazon ESCI: `https://github.com/amazon-science/esci-data`
- Behavioral ranking: source dataset not selected yet; the phase page states this explicitly.

```bash
curl "https://retail-search.feroshjacob.workers.dev/api/cranfield/search?q=wing%20pressure%20distribution"
curl "https://retail-search.feroshjacob.workers.dev/api/cranfield/explain?q=wing%20pressure%20distribution"
curl "https://retail-search.feroshjacob.workers.dev/api/cranfield/meta"
curl "https://retail-search.feroshjacob.workers.dev/api/cranfield/evaluation"
```

Latest aliases are available at `/api/search` and `/api/explain`.

## Local API Server

Set OpenSearch credentials first:

```bash
export OPENSEARCH_URL="https://your-opensearch.example"
export OPENSEARCH_USERNAME="..."
export OPENSEARCH_PASSWORD="..."
npm run dev
```

Then call:

```bash
curl "http://127.0.0.1:8787/api/cranfield/search?q=wing%20pressure"
curl "http://127.0.0.1:8787/api/cranfield/explain?q=wing%20pressure"
```

## Index Preparation

```bash
npm run prepare:index
```

The generated bulk file is written to `experiments/cranfield-v0/cranfield-sample-bulk.ndjson`.

To export the full public Cranfield corpus without deploying or writing to a live OpenSearch cluster:

```bash
npm run export:cranfield
```

See `docs/deployment-opensearch-cloudflare.md` for the recommended OpenSearch provider setup, credential split, Cloudflare variables, and cost caveats.

With `.env.local` configured, check the live OpenSearch provider and load Cranfield:

```bash
npm run opensearch:health
npm run load:cranfield
npm run eval:cranfield -- --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/evaluation-live.json
```
