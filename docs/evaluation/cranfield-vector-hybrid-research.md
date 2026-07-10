# Cranfield Vector And Hybrid Retrieval Research

Status: BGE vector/hybrid candidate beats refined PRF offline and in remote OpenSearch; promotion pending transferability policy
Generation: `GEN-018` / `GEN-019` / `GEN-022` / `GEN-023`
Search Evolution: `SE-0003`
Architecture: `ARCH-0.3-candidate`
Decision: `ADL-0003`

## Question

Can embedding-based vector retrieval improve Cranfield relevance beyond the current refined `prf-rerank` candidate?

## Implementation

GEN-018 adds an offline embedding and vector/hybrid evaluation path:

- `npm run embed:cranfield`
- `npm run eval:cranfield:vector`
- `src/evaluation/vector-search.js`

The embedding cache supports:

- `--provider openai` for real LLM embeddings through the OpenAI embeddings API
- `--provider ollama` for real local embeddings through Ollama `/api/embed`
- `--provider huggingface` for local SentenceTransformers retrieval embeddings
- `--provider local-hash` for deterministic local vector-control runs
- `--checkpoint-dir` for restartable local embedding runs
- `--text-profile full|title-abstract` for controlling document embedding text

The evaluator compares:

- vector-only retrieval across all 1,400 Cranfield documents
- cached OpenSearch field-sum retrieval
- linear score blends of cached field-sum plus vector results
- reciprocal-rank fusion of cached field-sum plus vector results

GEN-023 adds the remote OpenSearch validation path:

- `npm run load:cranfield:bge`
- `npm run eval:cranfield:opensearch-vector`
- `scripts/load-cranfield-bge-opensearch.mjs`
- `scripts/evaluate-cranfield-opensearch-vector.mjs`

The remote path creates a separate candidate index with the Cranfield mapping plus a `knn_vector` field, then evaluates OpenSearch kNN vector results, OpenSearch field-sum lexical results, and local hybrid fusion of those remote result sets.

## GEN-018 Local-Control Run

No `OPENAI_API_KEY` was configured in the local/project environment during GEN-018, so the real LLM embedding run was not executed.

The measured run used deterministic `local-hash` vectors as a plumbing/control artifact, not as an LLM embedding claim.

Commands:

```bash
npm run embed:cranfield -- --documents /private/tmp/retail-search-cranfield-live/documents.jsonl --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/embeddings-local-hash-gen018.json --provider local-hash --dimensions 384 --summary
npm run eval:cranfield:vector -- --embeddings experiments/cranfield-v0/embeddings-local-hash-gen018.json --documents /private/tmp/retail-search-cranfield-live/documents.jsonl --queries /private/tmp/retail-search-cranfield-live/queries.json --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --write experiments/cranfield-v0/evaluation-vector-local-hash-gen018.json --summary --top 10
npm run eval:cranfield:vector -- --embeddings experiments/cranfield-v0/embeddings-local-hash-gen018.json --documents /private/tmp/retail-search-cranfield-live/documents.jsonl --queries /private/tmp/retail-search-cranfield-live/queries.json --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --write experiments/cranfield-v0/evaluation-vector-local-hash-depth100-gen018.json --summary --vector-depth 100 --retrieve-size 100 --top 8
npm run eval:cranfield:vector -- --embeddings experiments/cranfield-v0/embeddings-local-hash-gen018.json --documents /private/tmp/retail-search-cranfield-live/documents.jsonl --queries /private/tmp/retail-search-cranfield-live/queries.json --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --write experiments/cranfield-v0/evaluation-vector-local-hash-k20-binary-gen018.json --summary --k 20 --relevance-mode binary --vector-depth 50 --retrieve-size 50 --top 8
```

## GEN-019 Local Ollama Run

The local LLM project at `/Users/feroshjacob/codefj/local_llm` wraps Ollama chat endpoints. It does not expose an embeddings route itself, so GEN-019 uses the same local Ollama service directly through `http://127.0.0.1:11434/api/embed`.

The completed embedding artifact uses Ollama `llama3.1:8b`, document title+abstract text, query text, and 4,096-dimensional normalized vectors.

Commands:

```bash
npm run embed:cranfield -- --provider ollama --host http://127.0.0.1:11434 --model llama3.1:8b --text-profile title-abstract --documents /private/tmp/retail-search-cranfield-live/documents.jsonl --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/embeddings-ollama-llama31-8b-title-abstract-gen019.json --checkpoint-dir /private/tmp/retail-search-ollama-llama31-8b-title-abstract-gen019-checkpoint --batch-size 16 --progress --summary
npm run eval:cranfield:vector -- --embeddings experiments/cranfield-v0/embeddings-ollama-llama31-8b-title-abstract-gen019.json --documents /private/tmp/retail-search-cranfield-live/documents.jsonl --queries /private/tmp/retail-search-cranfield-live/queries.json --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --write experiments/cranfield-v0/evaluation-vector-ollama-llama31-8b-title-abstract-gen019.json --summary --top 12
npm run eval:cranfield:vector -- --embeddings experiments/cranfield-v0/embeddings-ollama-llama31-8b-title-abstract-gen019.json --documents /private/tmp/retail-search-cranfield-live/documents.jsonl --queries /private/tmp/retail-search-cranfield-live/queries.json --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --write experiments/cranfield-v0/evaluation-vector-ollama-llama31-8b-title-abstract-depth100-gen019.json --summary --vector-depth 100 --retrieve-size 100 --top 12
npm run eval:cranfield:vector -- --embeddings experiments/cranfield-v0/embeddings-ollama-llama31-8b-title-abstract-gen019.json --documents /private/tmp/retail-search-cranfield-live/documents.jsonl --queries /private/tmp/retail-search-cranfield-live/queries.json --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --write experiments/cranfield-v0/evaluation-vector-ollama-llama31-8b-title-abstract-k20-binary-gen019.json --summary --k 20 --relevance-mode binary --vector-depth 50 --retrieve-size 50 --top 12
```

## GEN-022 Hugging Face BGE Run

GEN-022 uses a dedicated retrieval embedding model instead of a chat-model embedding endpoint. The run generated local SentenceTransformers embeddings with `BAAI/bge-base-en-v1.5`, document title+abstract text, a retrieval query prefix, and 768-dimensional normalized vectors.

Commands:

```bash
npm run embed:cranfield -- --provider huggingface --python-bin /private/tmp/retail-search-hf-venv/bin/python --model BAAI/bge-base-en-v1.5 --text-profile title-abstract --query-prefix "Represent this sentence for searching relevant passages: " --documents /private/tmp/retail-search-cranfield-live/documents.jsonl --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/embeddings-huggingface-bge-base-en-v15-title-abstract-gen022.json --checkpoint-dir /private/tmp/retail-search-hf-bge-base-en-v15-gen022-checkpoint --hf-cache-dir /private/tmp/retail-search-hf-cache --batch-size 2048 --encoder-batch-size 32 --progress --summary
npm run eval:cranfield:vector -- --embeddings experiments/cranfield-v0/embeddings-huggingface-bge-base-en-v15-title-abstract-gen022.json --documents /private/tmp/retail-search-cranfield-live/documents.jsonl --queries /private/tmp/retail-search-cranfield-live/queries.json --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --write experiments/cranfield-v0/evaluation-vector-huggingface-bge-base-en-v15-gen022.json --summary --top 20
npm run eval:cranfield:vector -- --embeddings experiments/cranfield-v0/embeddings-huggingface-bge-base-en-v15-title-abstract-gen022.json --documents /private/tmp/retail-search-cranfield-live/documents.jsonl --queries /private/tmp/retail-search-cranfield-live/queries.json --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --write experiments/cranfield-v0/evaluation-vector-huggingface-bge-base-en-v15-depth100-gen022.json --summary --top 20 --vector-depth 100
npm run eval:cranfield:vector -- --embeddings experiments/cranfield-v0/embeddings-huggingface-bge-base-en-v15-title-abstract-gen022.json --documents /private/tmp/retail-search-cranfield-live/documents.jsonl --queries /private/tmp/retail-search-cranfield-live/queries.json --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --write experiments/cranfield-v0/evaluation-vector-huggingface-bge-base-en-v15-depth100-k20-binary-gen022.json --summary --top 20 --k 20 --relevance-mode binary --vector-depth 100
```

## GEN-023 Remote OpenSearch BGE Run

GEN-023 validates the BGE candidate in a production-shaped OpenSearch index. It creates `cranfield-v0-bge-base-en-v15-gen023`, loads all 1,400 documents with 768-dimensional BGE vectors, and evaluates remote kNN plus remote lexical field-sum retrieval over all 225 queries.

Commands:

```bash
npm run load:cranfield:bge -- --documents /private/tmp/retail-search-cranfield-live/documents.jsonl --embeddings experiments/cranfield-v0/embeddings-huggingface-bge-base-en-v15-title-abstract-gen022.json --index cranfield-v0-bge-base-en-v15-gen023 --write experiments/cranfield-v0/load-opensearch-bge-base-en-v15-gen023.json --chunk-size 100 --summary
npm run eval:cranfield:opensearch-vector -- --index cranfield-v0-bge-base-en-v15-gen023 --embeddings experiments/cranfield-v0/embeddings-huggingface-bge-base-en-v15-title-abstract-gen022.json --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/evaluation-live-opensearch-bge-base-en-v15-gen023.json --summary --top 20 --vector-depth 100 --retrieve-size 50 --concurrency 10
npm run eval:cranfield:opensearch-vector -- --index cranfield-v0-bge-base-en-v15-gen023 --embeddings experiments/cranfield-v0/embeddings-huggingface-bge-base-en-v15-title-abstract-gen022.json --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/evaluation-live-opensearch-bge-base-en-v15-k20-binary-gen023.json --summary --top 20 --vector-depth 100 --retrieve-size 50 --concurrency 10 --k 20 --relevance-mode binary
```

## Results

Internal graded nDCG@10:

| Run | nDCG@10 | MAP | Precision@10 | Recall@10 | MRR | Status |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Refined PRF best | 0.3260 | 0.2699 | 0.2680 | 0.4469 | 0.5622 | prior lexical best |
| Field-sum cache | 0.3022 | 0.2452 | 0.2418 | 0.4136 | 0.5499 | baseline for vector blend |
| Local-hash vector-only | 0.1453 | 0.1054 | 0.1058 | 0.1867 | 0.3141 | rejected control |
| Local-hash hybrid linear, vector weight 0.1, depth 50 | 0.3052 | 0.2478 | 0.2418 | 0.4130 | 0.5463 | improved over field-sum, below PRF |
| Local-hash hybrid linear, vector weight 0.1, depth 100 | 0.3054 | 0.2490 | 0.2413 | 0.4112 | 0.5491 | best local control, below PRF |
| Ollama `llama3.1:8b` vector-only | 0.0282 | 0.0151 | 0.0173 | 0.0317 | 0.0690 | rejected |
| Ollama `llama3.1:8b` hybrid linear, vector weight 0.2, depth 50 | 0.3035 | 0.2462 | 0.2387 | 0.4083 | 0.5596 | best Ollama graded run, below PRF |
| Ollama `llama3.1:8b` hybrid linear, vector weight 0.1, depth 100 | 0.3026 | 0.2448 | 0.2418 | 0.4136 | 0.5497 | below PRF |
| BGE vector-only | 0.3419 | 0.2883 | 0.2720 | 0.4548 | 0.5785 | above PRF |
| BGE hybrid RRF, vector weight 0.8, depth 50 | 0.3533 | 0.2996 | 0.2804 | 0.4718 | 0.5892 | best BGE hybrid |
| BGE hybrid RRF, vector weight 0.8, depth 100 | 0.3533 | 0.2996 | 0.2804 | 0.4718 | 0.5892 | best BGE hybrid tied |
| Remote OpenSearch BGE vector-only | 0.3419 | 0.2883 | 0.2720 | 0.4548 | 0.5785 | above PRF |
| Remote OpenSearch BGE hybrid linear, vector weight 0.7, depth 100 | 0.3533 | 0.3017 | 0.2800 | 0.4726 | 0.5955 | best production-shaped candidate |

Paper-style binary nDCG@20:

| Run | nDCG@20 | MAP | Precision@20 | Recall@20 | MRR | Status |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Paper-style refined PRF best | 0.4563 | 0.3016 | 0.1756 | 0.5559 | 0.5606 | prior lexical comparable best |
| Field-sum cache | 0.4319 | 0.2766 | 0.1647 | 0.5276 | 0.5531 | baseline for vector blend |
| Local-hash hybrid linear, vector weight 0.1 | 0.4340 | 0.2794 | 0.1653 | 0.5307 | 0.5493 | improved over field-sum, below PRF |
| Ollama `llama3.1:8b` hybrid RRF, vector weight 0.1 | 0.4343 | 0.2787 | 0.1638 | 0.5274 | 0.5656 | best Ollama comparable run, below PRF |
| BGE vector-only | 0.4748 | 0.3217 | 0.1793 | 0.5658 | 0.5800 | above PRF |
| BGE hybrid linear, vector weight 0.6, depth 50 | 0.4903 | 0.3342 | 0.1847 | 0.5822 | 0.5963 | above PRF |
| BGE hybrid linear, vector weight 0.6, depth 100 | 0.4915 | 0.3349 | 0.1851 | 0.5842 | 0.5967 | best BGE binary |
| Remote OpenSearch BGE vector-only | 0.4748 | 0.3218 | 0.1793 | 0.5658 | 0.5800 | above PRF |
| Remote OpenSearch BGE hybrid linear, vector weight 0.6, depth 100 | 0.4926 | 0.3362 | 0.1851 | 0.5842 | 0.5990 | best production-shaped binary |

## Interpretation

The vector/hybrid infrastructure works. The deterministic local control and the real local Ollama embedding run can slightly improve the cached field-sum baseline, but neither beats the refined PRF candidate.

The Ollama result does answer the local-LLM question for the available `llama3.1:8b` model: using a chat model's embedding endpoint is not strong enough for Cranfield ranking here. The next valid experiment should use a dedicated embedding model or a neural reranker, then compare against the current refined PRF thresholds:

- graded nDCG@10 `0.3260`
- paper-style binary nDCG@20 `0.4563`

GEN-022 resolves that next experiment with BGE. Dedicated retrieval embeddings materially improve Cranfield:

- vector-only BGE beats refined PRF in both graded nDCG@10 and binary nDCG@20
- field-sum plus BGE hybrid is stronger than vector-only
- the best offline hybrid result is graded nDCG@10 `0.3533` and binary nDCG@20 `0.4915`

GEN-023 validates the production-shaped path. Remote OpenSearch kNN plus hybrid fusion reproduces the graded offline BGE gain and slightly improves the binary k=20 result.

This makes `ARCH-0.3-candidate` the strongest production-shaped Cranfield candidate. It is still not a released architecture because promotion requires transferability policy, public/default rollout decisions, and latency/cost review.

## OpenSearch Path

If real embeddings improve the offline run, the production-shaped path is:

1. create a new OpenSearch vector/hybrid index
2. add dense vector fields for document embeddings
3. run BM25 or field-sum plus k-NN vector retrieval
4. combine lexical and vector scores through a hybrid search pipeline
5. optionally rerank the hybrid top N with a cross-encoder

GEN-023 completed the remote validation path:

1. created a separate OpenSearch candidate index with a 768-dimensional BGE vector field
2. bulk loaded the current Cranfield documents plus cached BGE document vectors
3. ran lexical field-sum plus kNN/hybrid queries against that index
4. compared remote OpenSearch hybrid metrics against the offline BGE artifacts
5. kept the public/default architecture unchanged

Next decision points:

1. test transferability before any public/default promotion
2. compare the simpler remote BGE hybrid path against the more complex BGE-feature LTR path
3. add latency/cost evidence before deploying a vector index as the default search architecture
