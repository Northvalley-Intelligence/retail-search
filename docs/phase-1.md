# Phase 1 - Cranfield Foundation

## Traceability

- Mission: `M-0001`
- Search Evolution: `SE-0001`
- Architecture Version: `ARCH-0.1`
- Architecture Decision: `ADL-0001`
- Related Article: `A-0002`
- Git Tag: `v0.1.0`
- Git Commit: `baeae54`

## Mission

Build the smallest production-shaped search system using OpenSearch and Cranfield.

## Current Status

Phase 1 is live and validated.

- Production URL: `https://retail-search.feroshjacob.workers.dev/`
- Search endpoint: `/api/v0.1/search`
- Explain endpoint: `/api/v0.1/explain`
- Latest aliases: `/api/search`, `/api/explain`
- Dataset-specific endpoints: `/api/cranfield/search`, `/api/cranfield/explain`

## Implemented

- Cloudflare Worker-compatible API module.
- Cranfield search and explain endpoints.
- OpenSearch index mapping for Cranfield documents.
- OpenSearch BM25 baseline query generation.
- Full public Cranfield corpus load into `cranfield-v0`.
- Live Cranfield evaluation over 225 queries.
- Public search, data, explain, and evaluation pages.
- Dataset references for Cranfield, BEIR, and Amazon ESCI.
- Article 2 evidence handoff.
- Failure behavior grouping and `ARCH-0.2-candidate` field-sum evidence for Phase 2 transferability.

## Current Architecture

```text
Cranfield documents
  -> OpenSearch index cranfield-v0
  -> Cloudflare Worker API
  -> versioned search/explain endpoints
  -> evaluation artifacts
  -> public Phase 1 pages
```

## Metrics

Source: `experiments/cranfield-v0/evaluation-live.json`

| Metric | Value |
| --- | ---: |
| MAP | `0.2402` |
| nDCG@10 | `0.2995` |
| Precision@10 | `0.2316` |
| Recall@10 | `0.3994` |
| MRR | `0.5350` |

## Remaining Closure Work Before Phase 2

- Deploy the local `/api/v0.1/*` traceability route changes after explicit approval.
- Capture p95 latency, index size, memory, and index-time evidence.
- Test `ARCH-0.2-candidate` field-sum against BEIR before promoting it to a released architecture.
