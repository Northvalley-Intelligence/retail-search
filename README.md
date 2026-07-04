# Retail Search

Retail Search is a mission-driven OpenSearch project for discovering the simplest production-shaped retail search architecture that improves relevance while staying fast, explainable, reproducible, and deployable.

Phase 1 starts with a Cranfield baseline:

- OpenSearch index definition for Cranfield-shaped documents
- Cloudflare Worker-compatible search API
- `/api/cranfield/search?q=...`
- `/api/cranfield/explain?q=...`
- version aliases at `/api/v0/search`, `/api/v0/explain`, `/api/search`, and `/api/explain`
- baseline evaluation metrics for MAP, nDCG, Precision, Recall, and MRR
- architecture decision ledger

## Local Validation

```bash
npm run validate
```

The default validation run uses a fixture evaluator so the repository can be tested without downloading dependencies or requiring a live OpenSearch cluster. Final Phase 1 public acceptance still requires a live OpenSearch index and Cloudflare Worker deployment.

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
