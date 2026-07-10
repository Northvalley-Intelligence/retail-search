# ARCH-0.3-candidate - Cranfield Vector Hybrid Candidate

Status: remote OpenSearch candidate validated, transferability pending
Search Evolution: `SE-0003`
Mission: `M-0001`
Decision: `ADL-0003`
Git tag: not assigned

## Scope

`ARCH-0.3-candidate` adds vector/hybrid retrieval evaluation for Cranfield, including a separate remote OpenSearch kNN candidate index. It does not change the public API default.

The candidate path is:

1. create document and query embedding caches
2. rank all 1,400 Cranfield documents by vector similarity
3. compare vector-only retrieval with cached OpenSearch field-sum retrieval
4. blend or fuse vector results with field-sum retrieval pools
5. validate the best embedding candidate in remote OpenSearch before any public/default promotion

## Components Added

- Local vector helpers in `src/evaluation/vector-search.js`
- Embedding cache script in `scripts/cache-cranfield-embeddings.mjs`
- Vector/hybrid evaluator in `scripts/evaluate-cranfield-vector.mjs`
- Remote OpenSearch BGE vector loader in `scripts/load-cranfield-bge-opensearch.mjs`
- Remote OpenSearch BGE vector/hybrid evaluator in `scripts/evaluate-cranfield-opensearch-vector.mjs`
- Embedding providers:
  - deterministic `local-hash` control
  - OpenAI embeddings API
  - local Ollama `/api/embed`
  - local Hugging Face/SentenceTransformers retrieval embeddings
- Package scripts:
  - `npm run embed:cranfield`
  - `npm run eval:cranfield:vector`
  - `npm run load:cranfield:bge`
  - `npm run eval:cranfield:opensearch-vector`

## Current Evidence

GEN-018 validated vector/hybrid mechanics with deterministic `local-hash` control vectors. GEN-019 generated real local Ollama embeddings through `llama3.1:8b`, using document title+abstract text and query text. GEN-022 generated local Hugging Face BGE `BAAI/bge-base-en-v1.5` retrieval embeddings. GEN-023 validated BGE vector/hybrid retrieval in remote OpenSearch index `cranfield-v0-bge-base-en-v15-gen023`.

Best graded result:

| Metric | Field-sum cache | Best Ollama hybrid | Refined PRF best | Best offline BGE hybrid | Best remote BGE hybrid |
| --- | ---: | ---: | ---: | ---: | ---: |
| nDCG@10 | 0.3022 | 0.3035 | 0.3260 | 0.3533 | 0.3533 |
| MAP | 0.2452 | 0.2462 | 0.2699 | 0.2996 | 0.3017 |
| Precision@10 | 0.2418 | 0.2387 | 0.2680 | 0.2804 | 0.2800 |
| Recall@10 | 0.4136 | 0.4083 | 0.4469 | 0.4718 | 0.4726 |
| MRR | 0.5499 | 0.5596 | 0.5622 | 0.5892 | 0.5955 |

Paper-comparable result:

| Metric | Field-sum cache | Best Ollama hybrid | Refined PRF best | Best offline BGE hybrid | Best remote BGE hybrid |
| --- | ---: | ---: | ---: | ---: | ---: |
| nDCG@20 | 0.4319 | 0.4343 | 0.4563 | 0.4915 | 0.4926 |

## Status

BGE retrieval embeddings are strong enough to beat refined PRF both offline and in remote OpenSearch. `ARCH-0.3-candidate` remains unreleased because the evidence is still Cranfield-only and the public/default architecture has not been approved for promotion.

Promotion requires:

- traceable comparison artifact
- no public-default switch before transferability evidence
- latency/cost evidence for running the vector index as a default path
