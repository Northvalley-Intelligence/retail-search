# ARCH-0.2-candidate - Cranfield PRF Rerank Candidate

Status: candidate only, not released
Search Evolution: `SE-0002`
Mission: `M-0001`
Decision: `ADL-0002`
Git tag: not assigned

## Scope

This candidate keeps the released Phase 1 public default unchanged and tests opt-in query construction, reranking, metric, and index-profile changes for Cranfield.

`ARCH-0.1` uses one `multi_match` `best_fields` query over:

- `title^3`
- `abstract^2`
- `text`

`ARCH-0.2-candidate` first tested separate field-specific `match` clauses with the same boosts:

- title match, boost 3
- abstract match, boost 2
- text match, boost 1
- minimum one field must match

This lets evidence from multiple fields add together.

The current best `ARCH-0.2-candidate` path builds on field-sum with pseudo-relevance feedback:

- retrieve top 50 with field-sum
- normalize OpenSearch score inside the retrieved set
- treat the top 4 titles and abstracts as pseudo-relevant feedback
- extract 8 feedback terms
- add deterministic original-query and feedback-term title/abstract coverage features
- add a small adjacent-query-phrase coherence bonus at weight 0.01
- return the requested result count after reranking

GEN-014 also created a separate `cranfield-v0-paper-bm25` index profile using BM25 `k1=1.5` and `b=0.75` for NDCG@20 comparison with the Cranfield BERT paper. That index is comparison evidence only and does not replace `cranfield-v0`.

GEN-017 added a cached retrieval-pool fast loop for this candidate family. The cache stores live OpenSearch field-sum top-50 results for all Cranfield queries so deterministic reranker tuning can run offline. It is evaluation infrastructure, not a released architecture change.

## Components Added

- Failure behavior grouping in `src/evaluation/failure-analysis.js`
- Architecture selector in `src/cranfield/schema.js`
- Candidate query generation in `src/cranfield/search.js`
- Candidate coverage reranking in `src/cranfield/search.js`
- Candidate PRF reranking in `src/cranfield/search.js`
- Candidate phrase coherence reranking in `src/cranfield/search.js`
- Evaluation relevance modes in `src/evaluation/metrics.js`
- Paper-BM25 index profile in `src/cranfield/schema.js`
- Evaluation comparison script in `scripts/compare-cranfield-evaluations.mjs`
- Retrieval-pool cache generation in `scripts/cache-cranfield-retrieval-pools.mjs`
- Cached PRF tuning input in `scripts/tune-cranfield-prf.mjs`

## Components Removed

None.

## Components Modified

- `scripts/evaluate-cranfield.mjs` now supports:
  - `--architecture`
  - `--retrieve-size`
  - `--details`
  - `--relevance-mode`
  - failure behavior output
- `scripts/tune-cranfield-prf.mjs` supports `--retrieval-cache` so reranker tuning can reuse live first-stage pools without repeated remote OpenSearch calls.
- `src/cranfield/explain.js` reports the selected candidate architecture and rerank metadata when requested.
- `src/worker.js` accepts `architecture=field-sum`, `architecture=query-rescue`, `architecture=coverage-rerank`, or `architecture=prf-rerank` as opt-in query parameters.
- `scripts/load-cranfield-opensearch.mjs` accepts `--index-profile default|paper-bm25` for comparison indexing.

## Current Status

Refined PRF rerank is the best current live Cranfield candidate on the internal graded nDCG@10 ladder:

| Metric | `ARCH-0.1` baseline | `prf-rerank` |
| --- | ---: | ---: |
| MAP | 0.2402 | 0.2699 |
| nDCG@10 | 0.2995 | 0.3260 |
| Precision@10 | 0.2316 | 0.2680 |
| Recall@10 | 0.3994 | 0.4469 |
| MRR | 0.5350 | 0.5622 |

Paper-comparable binary NDCG@20 evidence:

| Run | NDCG@20 |
| --- | ---: |
| Default BM25 baseline | 0.4187 |
| Default refined PRF rerank | 0.4546 |
| Paper-style BM25 baseline | 0.4196 |
| Paper-style BM25 plus refined PRF rerank | 0.4563 |

It is not accepted as a cumulative architecture version yet.

Fast-loop evidence:

- `experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json` caches 225 field-sum top-50 retrieval pools from live OpenSearch.
- `experiments/cranfield-v0/prf-phrase-tuning-from-cache-gen017.json` reproduces nDCG@10 0.3260 offline from that cache.
- The cache must be refreshed when the index, analyzer, first-stage architecture, query set, or retrieve depth changes.

Phase 2 must test transferability before this can become a released architecture such as `ARCH-0.2` with a semantic git tag.
