# Phase 1 - Cranfield Foundation

## Mission

Build the smallest production-shaped search system using OpenSearch and Cranfield.

## Implemented In GEN-001

- Cloudflare Worker-compatible API module.
- Cranfield search and explain endpoints.
- OpenSearch index mapping for Cranfield-shaped documents.
- OpenSearch BM25 baseline query generation.
- Sample Cranfield-shaped fixture data for local validation.
- Evaluation metric implementation for MAP, nDCG, Precision, Recall, and MRR.
- Architecture decision record for the v0 baseline.
- GitHub validation workflow.

## Still Required For Public Phase 1 Acceptance

- Load a real Cranfield corpus into OpenSearch.
- Run the evaluator against the live OpenSearch index.
- Deploy the Worker to Cloudflare.
- Publish live endpoint URLs.
- Link the final article to the GitHub commit and live endpoint.

## Current Architecture

```text
Cranfield documents
  -> OpenSearch index cranfield-v0
  -> Cloudflare Worker API
  -> Search/explain endpoints
  -> Evaluation artifacts
```

## Validation Boundary

Local validation proves endpoint contracts, OpenSearch DSL generation, metric math, MDE artifact parseability, and the no-runtime-LLM rule. It does not prove live OpenSearch relevance or public endpoint availability until external services are configured.

