# ADL-0003 - Keep BGE Vector Hybrid As Remote-Validated Candidate

Status: remote OpenSearch candidate validated, transferability pending
Mission: `M-0001`
Search Evolution: `SE-0003`
Architecture version: `ARCH-0.3-candidate`
Dataset: Cranfield
Related article: `A-0002`
Related artifacts:

- `docs/evaluation/cranfield-vector-hybrid-research.md`
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

## Problem

The refined `prf-rerank` candidate improved Cranfield nDCG@10 to `0.3260`, but it remains lexical. The operator asked whether embeddings from LLMs and vector search could improve the system.

## Evidence

GEN-018 added embedding cache and vector/hybrid evaluation tooling. Its deterministic `local-hash` run validated the mechanics but was not an LLM embedding result.

GEN-019 added a local Ollama provider and generated real local embeddings with `llama3.1:8b`. The local LLM project at `/Users/feroshjacob/codefj/local_llm` wraps Ollama chat endpoints, so GEN-019 used the underlying Ollama `/api/embed` endpoint directly instead of changing that project.

GEN-022 added a local Hugging Face/SentenceTransformers provider and generated BGE `BAAI/bge-base-en-v1.5` embeddings. The graded Cranfield evidence beats refined PRF offline.

GEN-023 added a separate remote OpenSearch candidate index and validated BGE vector/hybrid retrieval through OpenSearch kNN:

| Run | nDCG@10 | Status |
| --- | ---: | --- |
| Refined PRF best | 0.3260 | prior lexical best |
| Field-sum cache | 0.3022 | comparison baseline |
| Local-hash vector-only | 0.1453 | rejected |
| Local-hash hybrid linear, vector weight 0.1, depth 100 | 0.3054 | below PRF |
| Ollama `llama3.1:8b` vector-only | 0.0282 | rejected |
| Ollama `llama3.1:8b` hybrid linear, vector weight 0.2, depth 50 | 0.3035 | below PRF |
| BGE vector-only | 0.3419 | above PRF |
| BGE hybrid RRF, vector weight 0.8, depth 50 | 0.3533 | best offline vector/hybrid candidate |
| Remote OpenSearch BGE vector-only | 0.3419 | above PRF |
| Remote OpenSearch BGE hybrid linear, vector weight 0.7, depth 100 | 0.3533 | best production-shaped candidate |

Paper-comparable binary nDCG@20:

| Run | nDCG@20 | Status |
| --- | ---: | --- |
| Paper-style BM25 plus refined PRF | 0.4563 | prior lexical comparable best |
| Field-sum cache | 0.4319 | comparison baseline |
| Local-hash hybrid linear, vector weight 0.1 | 0.4340 | below PRF |
| Ollama `llama3.1:8b` hybrid RRF, vector weight 0.1 | 0.4343 | below PRF |
| BGE vector-only | 0.4748 | above PRF |
| BGE hybrid linear, vector weight 0.6, depth 100 | 0.4915 | best offline vector/hybrid candidate |
| Remote OpenSearch BGE vector-only | 0.4748 | above PRF |
| Remote OpenSearch BGE hybrid linear, vector weight 0.6, depth 100 | 0.4926 | best production-shaped candidate |

## Alternatives Considered

1. Replace PRF with vector-only retrieval.
   - Rejected because local-hash vector-only nDCG@10 was `0.1453` and Ollama `llama3.1:8b` vector-only nDCG@10 was `0.0282`.

2. Blend cached field-sum with local vector scores.
   - Kept as infrastructure because it slightly improved field-sum, but rejected as a metric improvement candidate because it stayed below refined PRF.

3. Use local Ollama chat-model embeddings.
   - Executed in GEN-019 with `llama3.1:8b`; rejected as a promotion candidate because the best nDCG@10 was `0.3035`.

4. Use a dedicated BGE retrieval embedding model.
   - Executed in GEN-022 and kept as the strongest offline candidate because it improved graded nDCG@10 to `0.3533` and binary nDCG@20 to `0.4915`.

5. Build remote OpenSearch vector fields.
   - Executed in GEN-023 with separate index `cranfield-v0-bge-base-en-v15-gen023`; kept separate from public/default promotion.

## Decision

Keep `ARCH-0.3-candidate` as the strongest production-shaped Cranfield experiment path.

Do not promote it and do not change the public/default architecture yet. The next valid decision point is transferability evidence and runtime cost/latency review, followed by an explicit public/default promotion decision.

## Validation History

- `npm run embed:cranfield -- --provider local-hash`: passed and wrote 1,400 document embeddings plus 225 query embeddings.
- `npm run eval:cranfield:vector`: passed for graded nDCG@10 and binary nDCG@20 local-control comparisons.
- `npm run validate`: passed in `VAL-028` with 35 node tests and traceability checks through `GEN-018`.
- `npm run embed:cranfield -- --provider ollama --model llama3.1:8b`: passed and wrote 1,400 document embeddings plus 225 query embeddings.
- `npm run eval:cranfield:vector` with Ollama embeddings: passed for graded nDCG@10, depth-100, and binary nDCG@20 comparisons.
- `npm run validate`: passed in `VAL-029` with 35 node tests and traceability checks through `GEN-019`.
- `npm run embed:cranfield -- --provider huggingface --model BAAI/bge-base-en-v1.5`: passed and wrote 1,400 document embeddings plus 225 query embeddings.
- `npm run eval:cranfield:vector` with BGE embeddings: passed for graded nDCG@10, depth-100, and binary nDCG@20 comparisons.
- `npm run validate`: passed in `VAL-032` with traceability checks through `GEN-022`.
- `npm run load:cranfield:bge`: passed in GEN-023 and created `cranfield-v0-bge-base-en-v15-gen023` with 1,400 live documents and 768-dimensional BGE vectors.
- `npm run eval:cranfield:opensearch-vector`: passed in GEN-023 for graded nDCG@10 and binary nDCG@20 remote OpenSearch comparisons.

## Scope

Project-local Cranfield experiment only. GEN-023 created a separate remote OpenSearch candidate index, but no Cloudflare deployment or public/default switch was requested.
