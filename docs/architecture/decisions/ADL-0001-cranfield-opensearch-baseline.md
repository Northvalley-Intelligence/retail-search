# ADL-0001 - Cranfield OpenSearch Baseline

Legacy alias: `ADL-001`

## References

- Mission: `M-0001`
- Search Evolution Entry: `SE-0001`
- Architecture Version: `ARCH-0.1`
- Dataset: Cranfield
- Related Article: `A-0002`
- Intended Git Tag: `v0.1.0`

## Problem

The project needs a production-shaped starting point that can be measured and explained. Adding advanced components before a baseline would make later improvements hard to attribute.

## Evidence

The live Cranfield evaluation over 225 queries produced MAP `0.2402`, nDCG@10 `0.2995`, Precision@10 `0.2316`, Recall@10 `0.3994`, and MRR `0.5350`.

## Alternatives Considered

- Start with semantic search.
- Start with learning to rank.
- Start with query expansion or synonyms.
- Start with product-search data before a controlled IR baseline.

All were deferred until the OpenSearch baseline could be measured.

## Decision

Use OpenSearch BM25 as `ARCH-0.1`, the Phase 1 Cranfield retrieval and ranking baseline.

## Measured Impact

No previous production-shaped implementation exists. `ARCH-0.1` establishes the baseline every later experiment must beat.

## Validation History

- Local validation passes through `npm run validate`.
- Live OpenSearch evaluation is recorded in `experiments/cranfield-v0/evaluation-live.json`.
- Public Worker verification is recorded in `deploy/release-checks.json`.

## Scope

Cranfield only. BEIR transferability and Amazon ESCI retail relevance are later phases.

## Current Status

Accepted.
