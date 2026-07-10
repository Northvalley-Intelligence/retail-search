# Evaluation Timeline

This timeline is the metric ledger for Retail Search. It links each evaluation run to mission, generation, search evolution, architecture, decision, Git tag status, and the artifact that contains the reproducible evidence.

Git tags are assigned only to released architecture states. Candidate-only experiments intentionally keep `Git tag` as `not assigned` until promotion.

## Phase 1 Cranfield Ladder

| Evaluation | Date | Generation | Search Evolution | Architecture | Decision | Git Tag | Dataset / Metric Mode | Result | Artifact | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Live baseline | 2026-07-04 | `GEN-003` | `SE-0001` | `ARCH-0.1` | `ADL-0001` | `v0.1.0` | Cranfield, graded, k=10 | nDCG@10 `0.2995` | `experiments/cranfield-v0/evaluation-live.json` | released baseline |
| Detailed baseline regrouping | 2026-07-07 | `GEN-011` | `SE-0002` | `ARCH-0.1` baseline reference | `ADL-0002` | `v0.1.0` | Cranfield, graded, k=10 | nDCG@10 `0.2995` | `experiments/cranfield-v0/evaluation-live-baseline-gen011.json` | baseline reference |
| Query rescue | 2026-07-07 | `GEN-011` | `SE-0002` | `ARCH-0.2-candidate` | `ADL-0002` | not assigned | Cranfield, graded, k=10 | nDCG@10 `0.2904` | `experiments/cranfield-v0/evaluation-live-query-rescue-gen011.json` | rejected |
| Field sum | 2026-07-07 | `GEN-011` | `SE-0002` | `ARCH-0.2-candidate` | `ADL-0002` | not assigned | Cranfield, graded, k=10 | nDCG@10 `0.3022` | `experiments/cranfield-v0/evaluation-live-field-sum-gen011.json` | improved candidate |
| Coverage rerank | 2026-07-07 | `GEN-012` | `SE-0002` | `ARCH-0.2-candidate` | `ADL-0002` | not assigned | Cranfield, graded, k=10 | nDCG@10 `0.3095` | `experiments/cranfield-v0/evaluation-live-coverage-rerank-gen012.json` | improved candidate |
| PRF rerank | 2026-07-07 | `GEN-013` | `SE-0002` | `ARCH-0.2-candidate` | `ADL-0002` | not assigned | Cranfield, graded, k=10 | nDCG@10 `0.3253` | `experiments/cranfield-v0/evaluation-live-prf-rerank-gen013.json` | previous best candidate |
| PRF expanded retrieval | 2026-07-07 | `GEN-016` | `SE-0002` | `ARCH-0.2-candidate` | `ADL-0002` | not assigned | Cranfield, graded, k=10 | nDCG@10 `0.3219` | `experiments/cranfield-v0/evaluation-live-prf-expand-rerank-gen016.json` | rejected |
| PRF rerank plus phrase coherence | 2026-07-07 | `GEN-016` | `SE-0002` | `ARCH-0.2-candidate` | `ADL-0002` | not assigned | Cranfield, graded, k=10 | nDCG@10 `0.3260` | `experiments/cranfield-v0/evaluation-live-prf-rerank-phrase-gen016.json` | best live lexical candidate |

## Fast Reranker Tuning Evidence

GEN-017 does not claim a new ranking improvement. It records the faster evidence loop for reranker experiments: cache first-stage retrieval pools from live OpenSearch, tune deterministic rerankers offline, then remotely validate only winners.

| Evidence | Date | Generation | Search Evolution | Architecture | Decision | Git Tag | Dataset / Mode | Result | Artifact | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Field-sum retrieval pool cache | 2026-07-07 | `GEN-017` | `SE-0002` | `ARCH-0.2-candidate` first stage | `ADL-0002` | not assigned | Cranfield, top-50 retrieval pool | 225 queries cached | `experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json` | validated cache |
| PRF phrase tuning from cache | 2026-07-07 | `GEN-017` | `SE-0002` | `ARCH-0.2-candidate` reranker | `ADL-0002` | not assigned | Cranfield, graded, k=10 offline rerank | reproduced nDCG@10 `0.3260` | `experiments/cranfield-v0/prf-phrase-tuning-from-cache-gen017.json` | fast loop validated |

## Vector And Hybrid Retrieval Evidence

GEN-018 adds vector/hybrid evaluation infrastructure. Its measured artifacts use deterministic `local-hash` vectors as a control run, not as an LLM embedding result.

GEN-019 adds a real local embedding run through Ollama `llama3.1:8b`. The local Ollama embeddings were generated from document title+abstract text and query text. They slightly improved cached field-sum retrieval, but stayed below the refined PRF candidate.

GEN-022 adds local Hugging Face/SentenceTransformers embeddings with BGE `BAAI/bge-base-en-v1.5`. This is the first embedding evidence above refined PRF offline.

GEN-023 validates the BGE candidate in a separate remote OpenSearch kNN index, `cranfield-v0-bge-base-en-v15-gen023`. It reproduces the graded offline gain and slightly improves the binary k=20 result, while keeping the public/default architecture unchanged.

| Evidence | Date | Generation | Search Evolution | Architecture | Decision | Git Tag | Dataset / Mode | Result | Artifact | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Local-hash vector-only | 2026-07-07 | `GEN-018` | `SE-0003` | `ARCH-0.3-candidate` | `ADL-0003` | not assigned | Cranfield, graded, k=10 | nDCG@10 `0.1453` | `experiments/cranfield-v0/evaluation-vector-local-hash-gen018.json` | rejected control |
| Local-hash hybrid, depth 50 | 2026-07-07 | `GEN-018` | `SE-0003` | `ARCH-0.3-candidate` | `ADL-0003` | not assigned | Cranfield, graded, k=10 | nDCG@10 `0.3052` | `experiments/cranfield-v0/evaluation-vector-local-hash-gen018.json` | below refined PRF |
| Local-hash hybrid, depth 100 | 2026-07-07 | `GEN-018` | `SE-0003` | `ARCH-0.3-candidate` | `ADL-0003` | not assigned | Cranfield, graded, k=10 | nDCG@10 `0.3054` | `experiments/cranfield-v0/evaluation-vector-local-hash-depth100-gen018.json` | below refined PRF |
| Local-hash hybrid, binary k=20 | 2026-07-07 | `GEN-018` | `SE-0003` | `ARCH-0.3-candidate` | `ADL-0003` | not assigned | Cranfield, binary, k=20 | nDCG@20 `0.4340` | `experiments/cranfield-v0/evaluation-vector-local-hash-k20-binary-gen018.json` | below refined PRF |
| Ollama `llama3.1:8b` vector-only | 2026-07-08 | `GEN-019` | `SE-0003` | `ARCH-0.3-candidate` | `ADL-0003` | not assigned | Cranfield, graded, k=10 | nDCG@10 `0.0282` | `experiments/cranfield-v0/evaluation-vector-ollama-llama31-8b-title-abstract-gen019.json` | rejected |
| Ollama `llama3.1:8b` hybrid, depth 50 | 2026-07-08 | `GEN-019` | `SE-0003` | `ARCH-0.3-candidate` | `ADL-0003` | not assigned | Cranfield, graded, k=10 | nDCG@10 `0.3035` | `experiments/cranfield-v0/evaluation-vector-ollama-llama31-8b-title-abstract-gen019.json` | below refined PRF |
| Ollama `llama3.1:8b` hybrid, depth 100 | 2026-07-08 | `GEN-019` | `SE-0003` | `ARCH-0.3-candidate` | `ADL-0003` | not assigned | Cranfield, graded, k=10 | nDCG@10 `0.3026` | `experiments/cranfield-v0/evaluation-vector-ollama-llama31-8b-title-abstract-depth100-gen019.json` | below refined PRF |
| Ollama `llama3.1:8b` hybrid, binary k=20 | 2026-07-08 | `GEN-019` | `SE-0003` | `ARCH-0.3-candidate` | `ADL-0003` | not assigned | Cranfield, binary, k=20 | nDCG@20 `0.4343` | `experiments/cranfield-v0/evaluation-vector-ollama-llama31-8b-title-abstract-k20-binary-gen019.json` | below refined PRF |
| BGE vector-only | 2026-07-08 | `GEN-022` | `SE-0003` | `ARCH-0.3-candidate` | `ADL-0003` | not assigned | Cranfield, graded, k=10 | nDCG@10 `0.3419` | `experiments/cranfield-v0/evaluation-vector-huggingface-bge-base-en-v15-gen022.json` | above refined PRF |
| BGE hybrid RRF, depth 50 | 2026-07-08 | `GEN-022` | `SE-0003` | `ARCH-0.3-candidate` | `ADL-0003` | not assigned | Cranfield, graded, k=10 | nDCG@10 `0.3533` | `experiments/cranfield-v0/evaluation-vector-huggingface-bge-base-en-v15-gen022.json` | best hybrid graded |
| BGE hybrid RRF, depth 100 | 2026-07-08 | `GEN-022` | `SE-0003` | `ARCH-0.3-candidate` | `ADL-0003` | not assigned | Cranfield, graded, k=10 | nDCG@10 `0.3533` | `experiments/cranfield-v0/evaluation-vector-huggingface-bge-base-en-v15-depth100-gen022.json` | best hybrid graded tied |
| BGE hybrid linear, binary k=20 depth 100 | 2026-07-08 | `GEN-022` | `SE-0003` | `ARCH-0.3-candidate` | `ADL-0003` | not assigned | Cranfield, binary, k=20 | nDCG@20 `0.4915` | `experiments/cranfield-v0/evaluation-vector-huggingface-bge-base-en-v15-depth100-k20-binary-gen022.json` | best embedding binary |
| Remote OpenSearch BGE vector index load | 2026-07-08 | `GEN-023` | `SE-0003` | `ARCH-0.3-candidate` | `ADL-0003` | not assigned | Cranfield, 768-dimensional kNN index | 1,400 documents loaded | `experiments/cranfield-v0/load-opensearch-bge-base-en-v15-gen023.json` | remote candidate index validated |
| Remote OpenSearch BGE vector-only | 2026-07-08 | `GEN-023` | `SE-0003` | `ARCH-0.3-candidate` | `ADL-0003` | not assigned | Cranfield, graded, k=10 | nDCG@10 `0.3419` | `experiments/cranfield-v0/evaluation-live-opensearch-bge-base-en-v15-gen023.json` | above refined PRF |
| Remote OpenSearch BGE hybrid linear | 2026-07-08 | `GEN-023` | `SE-0003` | `ARCH-0.3-candidate` | `ADL-0003` | not assigned | Cranfield, graded, k=10 | nDCG@10 `0.3533` | `experiments/cranfield-v0/evaluation-live-opensearch-bge-base-en-v15-gen023.json` | best production-shaped candidate |
| Remote OpenSearch BGE hybrid linear, binary k=20 | 2026-07-08 | `GEN-023` | `SE-0003` | `ARCH-0.3-candidate` | `ADL-0003` | not assigned | Cranfield, binary, k=20 | nDCG@20 `0.4926` | `experiments/cranfield-v0/evaluation-live-opensearch-bge-base-en-v15-k20-binary-gen023.json` | best project comparable candidate |

## Learning-To-Rank Evidence

GEN-020 adds an offline LTR path over cached field-sum top-50 candidate pools. Promotion decisions use query-grouped 5-fold cross-validation. In-sample training is recorded only as capacity evidence.

| Evidence | Date | Generation | Search Evolution | Architecture | Decision | Git Tag | Dataset / Mode | Result | Artifact | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LTR with Ollama features, cross-validated | 2026-07-08 | `GEN-020` | `SE-0004` | `ARCH-0.4-candidate` | `ADL-0004` | not assigned | Cranfield, graded, k=10 | nDCG@10 `0.3164` | `experiments/cranfield-v0/evaluation-ltr-ollama-features-gen020.json` | below refined PRF |
| LTR lexical/PRF features, cross-validated | 2026-07-08 | `GEN-020` | `SE-0004` | `ARCH-0.4-candidate` | `ADL-0004` | not assigned | Cranfield, graded, k=10 | nDCG@10 `0.3166` | `experiments/cranfield-v0/evaluation-ltr-lexical-features-gen020.json` | best LTR CV, below refined PRF |
| LTR lexical/PRF features, in-sample | 2026-07-08 | `GEN-020` | `SE-0004` | `ARCH-0.4-candidate` | `ADL-0004` | not assigned | Cranfield, graded, k=10 | nDCG@10 `0.3338` | `experiments/cranfield-v0/evaluation-ltr-lexical-features-gen020.json` | capacity evidence only |
| LTR lexical/PRF features, binary cross-validated | 2026-07-08 | `GEN-020` | `SE-0004` | `ARCH-0.4-candidate` | `ADL-0004` | not assigned | Cranfield, binary, k=20 | nDCG@20 `0.4529` | `experiments/cranfield-v0/evaluation-ltr-lexical-features-k20-binary-gen020.json` | below refined PRF |
| LTR lexical/PRF features, binary in-sample | 2026-07-08 | `GEN-020` | `SE-0004` | `ARCH-0.4-candidate` | `ADL-0004` | not assigned | Cranfield, binary, k=20 | nDCG@20 `0.4607` | `experiments/cranfield-v0/evaluation-ltr-lexical-features-k20-binary-gen020.json` | capacity evidence only |
| Boosted-tree LTR, depth 3, cross-validated | 2026-07-08 | `GEN-021` | `SE-0004` | `ARCH-0.4-candidate` | `ADL-0004` | not assigned | Cranfield, graded, k=10 | nDCG@10 `0.3216` | `experiments/cranfield-v0/evaluation-ltr-boosted-trees-depth3-gen021.json` | best LTR graded CV, below refined PRF |
| Boosted-tree LTR, depth 3, in-sample | 2026-07-08 | `GEN-021` | `SE-0004` | `ARCH-0.4-candidate` | `ADL-0004` | not assigned | Cranfield, graded, k=10 | nDCG@10 `0.3564` | `experiments/cranfield-v0/evaluation-ltr-boosted-trees-depth3-gen021.json` | capacity evidence only |
| Boosted-tree LTR, depth 3, binary cross-validated | 2026-07-08 | `GEN-021` | `SE-0004` | `ARCH-0.4-candidate` | `ADL-0004` | not assigned | Cranfield, binary, k=20 | nDCG@20 `0.4457` | `experiments/cranfield-v0/evaluation-ltr-boosted-trees-depth3-k20-binary-gen021.json` | below lexical LTR and refined PRF |
| Boosted-tree LTR, depth 3, binary in-sample | 2026-07-08 | `GEN-021` | `SE-0004` | `ARCH-0.4-candidate` | `ADL-0004` | not assigned | Cranfield, binary, k=20 | nDCG@20 `0.4840` | `experiments/cranfield-v0/evaluation-ltr-boosted-trees-depth3-k20-binary-gen021.json` | capacity evidence only |
| LTR with BGE features, cross-validated | 2026-07-08 | `GEN-022` | `SE-0004` | `ARCH-0.4-candidate` | `ADL-0004` | not assigned | Cranfield, graded, k=10 | nDCG@10 `0.3541` | `experiments/cranfield-v0/evaluation-ltr-huggingface-bge-base-en-v15-features-gen022.json` | above refined PRF |
| Boosted-tree LTR with BGE features, cross-validated | 2026-07-08 | `GEN-022` | `SE-0004` | `ARCH-0.4-candidate` | `ADL-0004` | not assigned | Cranfield, graded, k=10 | nDCG@10 `0.3603` | `experiments/cranfield-v0/evaluation-ltr-boosted-trees-huggingface-bge-base-en-v15-features-gen022.json` | best LTR graded CV |
| LTR with BGE features, binary cross-validated | 2026-07-08 | `GEN-022` | `SE-0004` | `ARCH-0.4-candidate` | `ADL-0004` | not assigned | Cranfield, binary, k=20 | nDCG@20 `0.4857` | `experiments/cranfield-v0/evaluation-ltr-huggingface-bge-base-en-v15-features-k20-binary-gen022.json` | above refined PRF |
| Boosted-tree LTR with BGE features, binary cross-validated | 2026-07-08 | `GEN-022` | `SE-0004` | `ARCH-0.4-candidate` | `ADL-0004` | not assigned | Cranfield, binary, k=20 | nDCG@20 `0.4910` | `experiments/cranfield-v0/evaluation-ltr-boosted-trees-huggingface-bge-base-en-v15-features-k20-binary-gen022.json` | above refined PRF, below BGE hybrid binary |

## Paper-Comparable NDCG@20 Runs

The Cranfield BERT paper reports NDCG@20 with binary relevance. GEN-014 added a comparable local metric mode and a separate paper-style BM25 index profile. These runs do not replace the internal nDCG@10 ladder above.

| Evaluation | Date | Generation | Search Evolution | Architecture / Index | Decision | Git Tag | Dataset / Metric Mode | Result | Artifact | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Default BM25 baseline | 2026-07-07 | `GEN-014` | `SE-0001` reference | `ARCH-0.1` / `cranfield-v0` | `ADL-0001` | `v0.1.0` | Cranfield, binary, k=20 | nDCG@20 `0.4187` | `experiments/cranfield-v0/evaluation-live-baseline-k20-binary-gen014.json` | comparable baseline |
| Default PRF rerank | 2026-07-07 | `GEN-014` | `SE-0002` | `ARCH-0.2-candidate` / `cranfield-v0` | `ADL-0002` | not assigned | Cranfield, binary, k=20 | nDCG@20 `0.4542` | `experiments/cranfield-v0/evaluation-live-prf-rerank-k20-binary-gen014.json` | comparable candidate |
| Paper-style BM25 baseline | 2026-07-07 | `GEN-014` | `SE-0002` | `ARCH-0.2-candidate` / `cranfield-v0-paper-bm25` | `ADL-0002` | not assigned | Cranfield, binary, k=20 | nDCG@20 `0.4196` | `experiments/cranfield-v0/evaluation-live-paper-bm25-baseline-k20-binary-gen014.json` | paper-BM25 check |
| Paper-style BM25 plus PRF | 2026-07-07 | `GEN-014` | `SE-0002` | `ARCH-0.2-candidate` / `cranfield-v0-paper-bm25` | `ADL-0002` | not assigned | Cranfield, binary, k=20 | nDCG@20 `0.4547` | `experiments/cranfield-v0/evaluation-live-paper-bm25-prf-k20-binary-gen014.json` | previous best comparable candidate |
| Paper-style BM25 plus refined PRF | 2026-07-07 | `GEN-016` | `SE-0002` | `ARCH-0.2-candidate` / `cranfield-v0-paper-bm25` | `ADL-0002` | not assigned | Cranfield, binary, k=20 | nDCG@20 `0.4563` | `experiments/cranfield-v0/evaluation-live-paper-bm25-prf-phrase-k20-binary-gen016.json` | best comparable local candidate |
| Remote OpenSearch BGE hybrid | 2026-07-08 | `GEN-023` | `SE-0003` | `ARCH-0.3-candidate` / `cranfield-v0-bge-base-en-v15-gen023` | `ADL-0003` | not assigned | Cranfield, binary, k=20 | nDCG@20 `0.4926` | `experiments/cranfield-v0/evaluation-live-opensearch-bge-base-en-v15-k20-binary-gen023.json` | best project comparable candidate, still below BERT re-ranker |

Reference target from Ghasemi and Hiemstra, "BERT meets Cranfield":

| Method | NDCG@20 |
| --- | ---: |
| BM25 | `0.4714` |
| BERT re-ranker | `0.5525` |
| BERT full-ranker | `0.5670` |

## Required Update Rule

Every future metric-moving experiment must update these artifacts together:

- `MISSION_UPDATES.md`
- `docs/evaluation/timeline.md`
- `docs/evolution/timeline.md`
- the relevant `docs/evolution/experiments/SE-*.md` entry
- `docs/architecture/timeline.md`
- the relevant `docs/architecture/versions/ARCH-*.md` entry
- the relevant `docs/architecture/decisions/ADL-*.md` entry
- `.mde/traceability.json`
- `.mde/generation-summary.md`
- the experiment artifact list in `experiments/cranfield-v0/README.md`
