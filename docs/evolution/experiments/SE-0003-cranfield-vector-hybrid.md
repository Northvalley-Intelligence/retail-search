# SE-0003 - Cranfield Vector And Hybrid Retrieval

Status: BGE hybrid beats refined PRF offline and in remote OpenSearch; transferability pending
Mission: `M-0001`
Phase: Phase 1 - Cranfield Foundation
Dataset: Cranfield
Baseline architecture: `ARCH-0.1`
Prior best candidate: `ARCH-0.2-candidate`
Candidate architecture: `ARCH-0.3-candidate`
Decision: `ADL-0003`
Related article: `A-0002`
Git tag: not assigned

## Question

The current refined `prf-rerank` candidate improved graded nDCG@10 to `0.3260`, but it remains lexical and pseudo-relevance-feedback based. `SE-0003` tests whether vector retrieval can add a useful semantic recall signal.

## Implementation

GEN-018 adds:

- `src/evaluation/vector-search.js`
- `scripts/cache-cranfield-embeddings.mjs`
- `scripts/evaluate-cranfield-vector.mjs`
- `npm run embed:cranfield`
- `npm run eval:cranfield:vector`

The evaluator can run vector-only retrieval and hybrid retrieval over cached OpenSearch field-sum pools without hitting remote OpenSearch.

GEN-019 extends the embedding cache with:

- `--provider ollama` for local Ollama `/api/embed`
- `--host` for selecting the local Ollama endpoint
- `--checkpoint-dir` and `--progress` for long local embedding runs
- `--text-profile title-abstract` for Cranfield title+abstract embedding text

GEN-022 extends the embedding cache with:

- `--provider huggingface` for local SentenceTransformers retrieval embeddings
- `--python-bin` for selecting a temporary or project-local Python environment
- `--hf-cache-dir`, `--hf-device`, and `--encoder-batch-size` for model cache and encoding control
- `--query-prefix` and `--document-prefix` for retrieval-model prompt formatting

GEN-023 adds remote OpenSearch vector validation:

- `scripts/load-cranfield-bge-opensearch.mjs`
- `scripts/evaluate-cranfield-opensearch-vector.mjs`
- `npm run load:cranfield:bge`
- `npm run eval:cranfield:opensearch-vector`

## Evidence

Artifacts:

- `experiments/cranfield-v0/embeddings-local-hash-gen018.json`
- `experiments/cranfield-v0/evaluation-vector-local-hash-gen018.json`
- `experiments/cranfield-v0/evaluation-vector-local-hash-depth100-gen018.json`
- `experiments/cranfield-v0/evaluation-vector-local-hash-k20-binary-gen018.json`
- `experiments/cranfield-v0/embeddings-ollama-llama31-8b-title-abstract-gen019.json`
- `experiments/cranfield-v0/evaluation-vector-ollama-llama31-8b-title-abstract-gen019.json`
- `experiments/cranfield-v0/evaluation-vector-ollama-llama31-8b-title-abstract-depth100-gen019.json`
- `experiments/cranfield-v0/evaluation-vector-ollama-llama31-8b-title-abstract-k20-binary-gen019.json`
- `experiments/cranfield-v0/embeddings-huggingface-bge-base-en-v15-title-abstract-gen022.json`
- `experiments/cranfield-v0/evaluation-vector-huggingface-bge-base-en-v15-gen022.json`
- `experiments/cranfield-v0/evaluation-vector-huggingface-bge-base-en-v15-depth100-gen022.json`
- `experiments/cranfield-v0/evaluation-vector-huggingface-bge-base-en-v15-k20-binary-gen022.json`
- `experiments/cranfield-v0/evaluation-vector-huggingface-bge-base-en-v15-depth100-k20-binary-gen022.json`
- `experiments/cranfield-v0/load-opensearch-bge-base-en-v15-gen023.json`
- `experiments/cranfield-v0/evaluation-live-opensearch-bge-base-en-v15-gen023.json`
- `experiments/cranfield-v0/evaluation-live-opensearch-bge-base-en-v15-k20-binary-gen023.json`
- `docs/evaluation/cranfield-vector-hybrid-research.md`

Best graded nDCG@10:

| Run | nDCG@10 | Status |
| --- | ---: | --- |
| Refined `prf-rerank` best | 0.3260 | prior lexical best |
| Field-sum cache | 0.3022 | comparison baseline |
| Local-hash vector-only | 0.1453 | rejected |
| Local-hash hybrid linear, vector weight 0.1, depth 100 | 0.3054 | improves field-sum, below PRF |
| Ollama `llama3.1:8b` vector-only | 0.0282 | rejected |
| Ollama `llama3.1:8b` hybrid linear, vector weight 0.2, depth 50 | 0.3035 | improves field-sum, below PRF |
| BGE vector-only | 0.3419 | above PRF |
| BGE hybrid RRF, vector weight 0.8, depth 50 | 0.3533 | best offline vector/hybrid candidate |
| Remote OpenSearch BGE vector-only | 0.3419 | above PRF |
| Remote OpenSearch BGE hybrid linear, vector weight 0.7, depth 100 | 0.3533 | best production-shaped candidate |

Best binary nDCG@20:

| Run | nDCG@20 | Status |
| --- | ---: | --- |
| Paper-style BM25 plus refined PRF | 0.4563 | prior lexical comparable best |
| Field-sum cache | 0.4319 | comparison baseline |
| Local-hash hybrid linear, vector weight 0.1 | 0.4340 | improves field-sum, below PRF |
| Ollama `llama3.1:8b` hybrid RRF, vector weight 0.1 | 0.4343 | improves field-sum, below PRF |
| BGE vector-only | 0.4748 | above PRF |
| BGE hybrid linear, vector weight 0.6, depth 100 | 0.4915 | best offline vector/hybrid candidate |
| Remote OpenSearch BGE vector-only | 0.4748 | above PRF |
| Remote OpenSearch BGE hybrid linear, vector weight 0.6, depth 100 | 0.4926 | best production-shaped candidate |

## Decision

Do not promote vector/hybrid retrieval based on the local-control or local Ollama run.

GEN-022 BGE evidence beats the refined PRF candidate offline, so `ARCH-0.3-candidate` is no longer only infrastructure. GEN-023 validates that path in remote OpenSearch. It is now the strongest production-shaped Cranfield candidate path.

Do not promote it to the public/default architecture until transferability policy and runtime cost/latency are addressed.

## Remote Validation Command

```bash
npm run load:cranfield:bge -- --documents /private/tmp/retail-search-cranfield-live/documents.jsonl --embeddings experiments/cranfield-v0/embeddings-huggingface-bge-base-en-v15-title-abstract-gen022.json --index cranfield-v0-bge-base-en-v15-gen023 --write experiments/cranfield-v0/load-opensearch-bge-base-en-v15-gen023.json --chunk-size 100 --summary
npm run eval:cranfield:opensearch-vector -- --index cranfield-v0-bge-base-en-v15-gen023 --embeddings experiments/cranfield-v0/embeddings-huggingface-bge-base-en-v15-title-abstract-gen022.json --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/evaluation-live-opensearch-bge-base-en-v15-gen023.json --summary --top 20 --vector-depth 100 --retrieve-size 50 --concurrency 10
npm run eval:cranfield:opensearch-vector -- --index cranfield-v0-bge-base-en-v15-gen023 --embeddings experiments/cranfield-v0/embeddings-huggingface-bge-base-en-v15-title-abstract-gen022.json --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/evaluation-live-opensearch-bge-base-en-v15-k20-binary-gen023.json --summary --top 20 --vector-depth 100 --retrieve-size 50 --concurrency 10 --k 20 --relevance-mode binary
```

## Next Required Experiment

Before promotion, validate transferability beyond Cranfield and compare the simpler remote BGE hybrid path against the more complex BGE-feature LTR path.

## Rollback

No public rollback is needed. These generations add candidate-only evaluation tooling, artifacts, and a separate remote OpenSearch vector index. The public default remains `ARCH-0.1`; BGE hybrid is the best production-shaped candidate but has not been deployed as the default or promoted.
