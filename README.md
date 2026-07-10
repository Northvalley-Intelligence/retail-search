# Retail Search

Retail Search is a mission-driven OpenSearch project for discovering the simplest production-shaped retail search architecture that improves relevance while staying fast, explainable, reproducible, and deployable.

Phase 1 starts with a Cranfield baseline:

- OpenSearch index definition for Cranfield-shaped documents
- Cloudflare Worker-compatible search API
- `/api/cranfield/search?q=...`
- `/api/cranfield/explain?q=...`
- version aliases at `/api/v0/search`, `/api/v0/explain`, `/api/search`, and `/api/explain`
- milestone aliases at `/api/milestones/arch-0.1/*`, `/api/milestones/arch-0.2-prf/*`, and `/api/milestones/arch-0.3-bge/*`
- public home page that lists all project phases
- focused Phase 1 pages for search, indexed-data details, Search Explain, and evaluation results
- baseline evaluation metrics for MAP, nDCG, Precision, Recall, and MRR
- architecture decision ledger

## Local Validation

```bash
npm run validate
```

The default validation run uses a fixture evaluator so the repository can be tested without downloading dependencies or requiring a live OpenSearch cluster. Phase 1 public acceptance is also verified against the deployed Cloudflare Worker and live `cranfield-v0` OpenSearch index.

## Public Site

Open the public home page:

```text
https://retail-search.feroshjacob.workers.dev
```

The home page lists the project phases. Phase 1 is split into focused pages so the search demo, indexed-data guidance, explain flow, and evaluation results do not crowd one page.

```text
/phases/cranfield
/phases/cranfield/search
/phases/cranfield/data
/phases/cranfield/explain
/phases/cranfield/evaluation
```

Short aliases are also available at `/phase-1`, `/phase-1/search`, `/phase-1/data`, `/phase-1/explain`, and `/phase-1/evaluation`.

The public pages link to the dataset sources used or planned for each phase:

- Cranfield: `https://ir.dcs.gla.ac.uk/resources/test_collections/cran/`
- BEIR: `https://github.com/beir-cellar/beir`
- Amazon ESCI: `https://github.com/amazon-science/esci-data`
- Behavioral ranking: source dataset not selected yet; the phase page states this explicitly.

```bash
curl "https://retail-search.feroshjacob.workers.dev/api/cranfield/search?q=wing%20pressure%20distribution"
curl "https://retail-search.feroshjacob.workers.dev/api/cranfield/explain?q=wing%20pressure%20distribution"
curl "https://retail-search.feroshjacob.workers.dev/api/cranfield/meta"
curl "https://retail-search.feroshjacob.workers.dev/api/cranfield/evaluation"
```

Latest aliases are available at `/api/search` and `/api/explain`.

Milestone endpoints expose stable comparison paths for the key Cranfield architecture states:

```bash
curl "https://retail-search.feroshjacob.workers.dev/api/milestones/arch-0.1/search?q=wing%20pressure%20distribution"
curl "https://retail-search.feroshjacob.workers.dev/api/milestones/arch-0.1/explain?q=wing%20pressure%20distribution"
curl "https://retail-search.feroshjacob.workers.dev/api/milestones/arch-0.2-prf/search?q=wing%20pressure%20distribution"
curl "https://retail-search.feroshjacob.workers.dev/api/milestones/arch-0.2-prf/explain?q=wing%20pressure%20distribution"
curl "https://retail-search.feroshjacob.workers.dev/api/milestones/arch-0.3-bge/search?q=wing%20pressure%20distribution"
curl "https://retail-search.feroshjacob.workers.dev/api/milestones/arch-0.3-bge/explain?q=wing%20pressure%20distribution"
curl "https://retail-search.feroshjacob.workers.dev/api/milestones/arch-0.3-bge/demo?sample=all"
```

The BGE milestone currently returns `501 milestone_runtime_not_enabled`: the remote OpenSearch BGE candidate is validated, but arbitrary live queries still need runtime query-vector generation or a bounded known-query embedding cache. See `docs/endpoints/milestone-endpoints.md`.
The `demo` route returns archived GEN-023 sample rows so the UI can show a few `ARCH-0.3` examples without claiming live runtime support.

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
curl "http://127.0.0.1:8787/api/milestones/arch-0.1/search?q=wing%20pressure"
curl "http://127.0.0.1:8787/api/milestones/arch-0.2-prf/search?q=wing%20pressure"
curl "http://127.0.0.1:8787/api/milestones/arch-0.3-bge/demo?sample=3"
```

## Index Preparation

```bash
npm run prepare:index
```

The generated bulk file is written to `experiments/cranfield-v0/cranfield-sample-bulk.ndjson`.

To export the full public Cranfield corpus without deploying or writing to a live OpenSearch cluster:

```bash
npm run export:cranfield
```

See `docs/deployment-opensearch-cloudflare.md` for the recommended OpenSearch provider setup, credential split, Cloudflare variables, and cost caveats.

With `.env.local` configured, check the live OpenSearch provider and load Cranfield:

```bash
npm run opensearch:health
npm run load:cranfield
npm run eval:cranfield -- --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/evaluation-live.json
```

## Cranfield Failure Analysis

GEN-011 groups failing Cranfield queries by observed behavior and compares opt-in architecture candidates without replacing the public baseline.

```bash
npm run eval:cranfield -- --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/evaluation-live-baseline-gen011.json --summary --details --retrieve-size 50 --concurrency 10 --architecture baseline
npm run eval:cranfield -- --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/evaluation-live-field-sum-gen011.json --summary --details --retrieve-size 50 --concurrency 10 --architecture field-sum
npm run eval:cranfield -- --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/evaluation-live-coverage-rerank-gen012.json --summary --details --retrieve-size 50 --concurrency 10 --architecture coverage-rerank
npm run eval:cranfield -- --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/evaluation-live-prf-rerank-gen013.json --summary --details --retrieve-size 50 --concurrency 10 --architecture prf-rerank
npm run compare:cranfield -- --baseline experiments/cranfield-v0/evaluation-live-baseline-gen011.json --candidate experiments/cranfield-v0/evaluation-live-coverage-rerank-gen012.json --candidate experiments/cranfield-v0/evaluation-live-prf-rerank-gen013.json --write experiments/cranfield-v0/evaluation-comparison-gen013.json --summary
```

Current best lexical candidate: refined `prf-rerank`, with live graded nDCG@10 `0.3260` versus baseline `0.2995`. Vector/hybrid and paper-comparable binary NDCG@20 evidence is tracked separately in `docs/evaluation/timeline.md`.

See `docs/evaluation/timeline.md`, `docs/evaluation/cranfield-failure-groups.md`, `docs/evaluation/cranfield-prf-rerank-research.md`, and `docs/evolution/experiments/SE-0002-cranfield-field-sum.md`.

## Fast Reranker Tuning

Use remote OpenSearch once to cache first-stage retrieval pools, then tune deterministic rerankers offline against qrels:

```bash
npm run cache:cranfield -- --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --architecture field-sum --retrieve-size 50 --concurrency 10 --summary
npm run tune:cranfield:prf -- --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --write experiments/cranfield-v0/prf-phrase-tuning-from-cache-gen017.json --top 8
```

This keeps remote OpenSearch for cache refreshes and final validation only.

## Vector And Hybrid Experiments

GEN-018/GEN-019/GEN-022 add offline vector-only and hybrid retrieval evaluation. Provider options:

- `--provider local-hash` for deterministic plumbing-control vectors only
- `--provider openai` for OpenAI embedding API runs
- `--provider ollama` for local Ollama embeddings, including the Ollama instance used behind `/Users/feroshjacob/codefj/local_llm`
- `--provider huggingface` for local SentenceTransformers/Hugging Face retrieval embeddings

```bash
npm run embed:cranfield -- --documents /private/tmp/retail-search-cranfield-live/documents.jsonl --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/embeddings-local-hash-gen018.json --provider local-hash --dimensions 384 --summary
npm run eval:cranfield:vector -- --embeddings experiments/cranfield-v0/embeddings-local-hash-gen018.json --documents /private/tmp/retail-search-cranfield-live/documents.jsonl --queries /private/tmp/retail-search-cranfield-live/queries.json --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --write experiments/cranfield-v0/evaluation-vector-local-hash-gen018.json --summary --top 10
npm run embed:cranfield -- --provider ollama --host http://127.0.0.1:11434 --model llama3.1:8b --text-profile title-abstract --documents /private/tmp/retail-search-cranfield-live/documents.jsonl --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/embeddings-ollama-llama31-8b-title-abstract-gen019.json --checkpoint-dir /private/tmp/retail-search-ollama-llama31-8b-title-abstract-gen019-checkpoint --batch-size 16 --progress --summary
npm run eval:cranfield:vector -- --embeddings experiments/cranfield-v0/embeddings-ollama-llama31-8b-title-abstract-gen019.json --documents /private/tmp/retail-search-cranfield-live/documents.jsonl --queries /private/tmp/retail-search-cranfield-live/queries.json --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --write experiments/cranfield-v0/evaluation-vector-ollama-llama31-8b-title-abstract-gen019.json --summary --top 12
npm run embed:cranfield -- --provider huggingface --python-bin /private/tmp/retail-search-hf-venv/bin/python --model BAAI/bge-base-en-v1.5 --text-profile title-abstract --query-prefix "Represent this sentence for searching relevant passages: " --documents /private/tmp/retail-search-cranfield-live/documents.jsonl --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/embeddings-huggingface-bge-base-en-v15-title-abstract-gen022.json --checkpoint-dir /private/tmp/retail-search-hf-bge-base-en-v15-gen022-checkpoint --hf-cache-dir /private/tmp/retail-search-hf-cache --batch-size 2048 --encoder-batch-size 32 --progress --summary
npm run eval:cranfield:vector -- --embeddings experiments/cranfield-v0/embeddings-huggingface-bge-base-en-v15-title-abstract-gen022.json --documents /private/tmp/retail-search-cranfield-live/documents.jsonl --queries /private/tmp/retail-search-cranfield-live/queries.json --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --write experiments/cranfield-v0/evaluation-vector-huggingface-bge-base-en-v15-depth100-gen022.json --summary --top 20 --vector-depth 100
npm run load:cranfield:bge -- --documents /private/tmp/retail-search-cranfield-live/documents.jsonl --embeddings experiments/cranfield-v0/embeddings-huggingface-bge-base-en-v15-title-abstract-gen022.json --index cranfield-v0-bge-base-en-v15-gen023 --write experiments/cranfield-v0/load-opensearch-bge-base-en-v15-gen023.json --chunk-size 100 --summary
npm run eval:cranfield:opensearch-vector -- --index cranfield-v0-bge-base-en-v15-gen023 --embeddings experiments/cranfield-v0/embeddings-huggingface-bge-base-en-v15-title-abstract-gen022.json --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/evaluation-live-opensearch-bge-base-en-v15-gen023.json --summary --top 20 --vector-depth 100 --retrieve-size 50 --concurrency 10
npm run eval:cranfield:opensearch-vector -- --index cranfield-v0-bge-base-en-v15-gen023 --embeddings experiments/cranfield-v0/embeddings-huggingface-bge-base-en-v15-title-abstract-gen022.json --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/evaluation-live-opensearch-bge-base-en-v15-k20-binary-gen023.json --summary --top 20 --vector-depth 100 --retrieve-size 50 --concurrency 10 --k 20 --relevance-mode binary
```

Local embedding result: Ollama `llama3.1:8b` generated real local embeddings, but the best hybrid reached nDCG@10 `0.3035`, below refined `prf-rerank` nDCG@10 `0.3260`. Paper-comparable binary nDCG@20 reached `0.4343`, below refined PRF `0.4563`. `ARCH-0.3-candidate` is therefore not promoted.

Hugging Face result: BGE `BAAI/bge-base-en-v1.5` is the first embedding run to beat refined PRF. Offline best hybrid graded nDCG@10 is `0.3533`, and offline best hybrid binary nDCG@20 is `0.4915`. GEN-023 validated the same path in remote OpenSearch with a separate kNN candidate index: best remote hybrid graded nDCG@10 is `0.3533`, and best remote hybrid binary nDCG@20 is `0.4926`. `ARCH-0.3-candidate` is still candidate-only until transferability and public/default promotion policy are addressed.

## LTR Experiments

GEN-020 adds offline learning-to-rank evaluation over cached field-sum candidate pools. It uses query-grouped 5-fold cross-validation for promotion decisions and reports in-sample training separately as capacity evidence.

```bash
npm run eval:cranfield:ltr -- --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --embeddings experiments/cranfield-v0/embeddings-ollama-llama31-8b-title-abstract-gen019.json --write experiments/cranfield-v0/evaluation-ltr-ollama-features-gen020.json --summary
npm run eval:cranfield:ltr -- --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --write experiments/cranfield-v0/evaluation-ltr-lexical-features-gen020.json --summary
```

LTR result: best cross-validated graded nDCG@10 is `0.3166` with lexical/PRF-style features only, below refined `prf-rerank` nDCG@10 `0.3260`. Best cross-validated binary nDCG@20 is `0.4529`, below refined PRF `0.4563`. The candidate pool oracle is high (`0.7033` nDCG@10), so ranking headroom exists, but `ARCH-0.4-candidate` is not promoted yet. The cached Llama embeddings did not help the LTR ablation.

GEN-021 adds pointwise boosted-tree LTR:

```bash
npm run eval:cranfield:ltr -- --model boosted-trees --tree-count 60 --learning-rate 0.05 --max-depth 3 --min-leaf-size 12 --max-thresholds 12 --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --write experiments/cranfield-v0/evaluation-ltr-boosted-trees-depth3-gen021.json --summary
```

Boosted-tree result: graded cross-validation improved to nDCG@10 `0.3216`, closer to refined PRF but still below `0.3260`. Binary cross-validation was `0.4457`, below the prior lexical LTR `0.4529` and refined PRF `0.4563`. In-sample boosted trees reached `0.3564` / `0.4840`, so the issue is generalization, not lack of capacity.

GEN-022 adds BGE retrieval embeddings as LTR features:

```bash
npm run eval:cranfield:ltr -- --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --embeddings experiments/cranfield-v0/embeddings-huggingface-bge-base-en-v15-title-abstract-gen022.json --write experiments/cranfield-v0/evaluation-ltr-huggingface-bge-base-en-v15-features-gen022.json --summary
npm run eval:cranfield:ltr -- --model boosted-trees --tree-count 60 --learning-rate 0.05 --max-depth 3 --min-leaf-size 12 --max-thresholds 12 --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --embeddings experiments/cranfield-v0/embeddings-huggingface-bge-base-en-v15-title-abstract-gen022.json --write experiments/cranfield-v0/evaluation-ltr-boosted-trees-huggingface-bge-base-en-v15-features-gen022.json --summary
```

BGE LTR result: coordinate-ascent with BGE features reaches cross-validated nDCG@10 `0.3541`; boosted-tree LTR with BGE features reaches cross-validated nDCG@10 `0.3603`. Binary boosted-tree LTR reaches nDCG@20 `0.4910`, while the simpler BGE hybrid run remains slightly better at `0.4915`.
