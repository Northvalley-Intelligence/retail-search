# Cranfield Learning-To-Rank Research

Status: BGE feature LTR beats refined PRF offline; simpler remote BGE hybrid is currently preferred
Generation: `GEN-020` / `GEN-021` / `GEN-022`
Search Evolution: `SE-0004`
Architecture: `ARCH-0.4-candidate`
Decision: `ADL-0004`

## Question

Can supervised learning-to-rank reorder the cached field-sum top-50 candidate pool better than the refined `prf-rerank` candidate?

## Implementation

GEN-020 adds:

- `src/evaluation/ltr.js`
- `scripts/evaluate-cranfield-ltr.mjs`
- `npm run eval:cranfield:ltr`
- `test/ltr.test.js`

The LTR evaluator builds features from each query-result pair:

- lexical field-sum score and rank features
- title, abstract, and combined query-token coverage
- adjacent phrase coverage
- pseudo-relevance-feedback term coverage
- PRF-style combined score
- optional Ollama vector similarity and vector-rank features
- title and abstract length features

Promotion decisions use query-grouped 5-fold cross-validation. In-sample training is recorded only to estimate whether the feature set has ranking capacity.

GEN-021 extends the evaluator with dependency-free pointwise gradient-boosted regression trees. This is a stronger local LTR model than coordinate ascent, but it is still evaluated under the same query-grouped promotion rule.

GEN-022 adds BGE `BAAI/bge-base-en-v1.5` retrieval embeddings as vector similarity and vector-rank features.

## Commands

```bash
npm run eval:cranfield:ltr -- --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --embeddings experiments/cranfield-v0/embeddings-ollama-llama31-8b-title-abstract-gen019.json --write experiments/cranfield-v0/evaluation-ltr-ollama-features-gen020.json --summary --top 12
npm run eval:cranfield:ltr -- --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --embeddings experiments/cranfield-v0/embeddings-ollama-llama31-8b-title-abstract-gen019.json --write experiments/cranfield-v0/evaluation-ltr-ollama-features-k20-binary-gen020.json --summary --k 20 --relevance-mode binary --top 12
npm run eval:cranfield:ltr -- --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --write experiments/cranfield-v0/evaluation-ltr-lexical-features-gen020.json --summary --top 8
npm run eval:cranfield:ltr -- --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --write experiments/cranfield-v0/evaluation-ltr-lexical-features-k20-binary-gen020.json --summary --k 20 --relevance-mode binary --top 8
npm run eval:cranfield:ltr -- --model boosted-trees --tree-count 60 --learning-rate 0.05 --max-depth 3 --min-leaf-size 12 --max-thresholds 12 --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --write experiments/cranfield-v0/evaluation-ltr-boosted-trees-depth3-gen021.json --summary --top 8
npm run eval:cranfield:ltr -- --model boosted-trees --tree-count 60 --learning-rate 0.05 --max-depth 3 --min-leaf-size 12 --max-thresholds 12 --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --write experiments/cranfield-v0/evaluation-ltr-boosted-trees-depth3-k20-binary-gen021.json --summary --k 20 --relevance-mode binary --top 8
npm run eval:cranfield:ltr -- --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --embeddings experiments/cranfield-v0/embeddings-huggingface-bge-base-en-v15-title-abstract-gen022.json --write experiments/cranfield-v0/evaluation-ltr-huggingface-bge-base-en-v15-features-gen022.json --summary --top 12
npm run eval:cranfield:ltr -- --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --embeddings experiments/cranfield-v0/embeddings-huggingface-bge-base-en-v15-title-abstract-gen022.json --write experiments/cranfield-v0/evaluation-ltr-huggingface-bge-base-en-v15-features-k20-binary-gen022.json --summary --k 20 --relevance-mode binary --top 12
npm run eval:cranfield:ltr -- --model boosted-trees --tree-count 60 --learning-rate 0.05 --max-depth 3 --min-leaf-size 12 --max-thresholds 12 --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --embeddings experiments/cranfield-v0/embeddings-huggingface-bge-base-en-v15-title-abstract-gen022.json --write experiments/cranfield-v0/evaluation-ltr-boosted-trees-huggingface-bge-base-en-v15-features-gen022.json --summary --top 8
npm run eval:cranfield:ltr -- --model boosted-trees --tree-count 60 --learning-rate 0.05 --max-depth 3 --min-leaf-size 12 --max-thresholds 12 --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --embeddings experiments/cranfield-v0/embeddings-huggingface-bge-base-en-v15-title-abstract-gen022.json --write experiments/cranfield-v0/evaluation-ltr-boosted-trees-huggingface-bge-base-en-v15-features-k20-binary-gen022.json --summary --k 20 --relevance-mode binary --top 8
```

## Candidate-Pool Headroom

The cached field-sum top-50 pool contains judged relevant documents for most queries, but not all judged relevant documents.

| Pool fact | Value |
| --- | ---: |
| Relevant judgments | 1,612 |
| Relevant docs present in top-50 pools | 974 |
| Relevant-document pool recall | 0.6042 |
| Queries with at least one relevant doc in pool | 217 / 225 |
| Query coverage | 0.9644 |
| Oracle nDCG@10 if pool were perfectly reranked | 0.7033 |
| Oracle binary nDCG@20 if pool were perfectly reranked | 0.7482 |

This confirms there is substantial ranking headroom inside the existing candidate pool. It also confirms the system is not purely ranking-limited, because 8 queries still have no judged relevant document in the top-50 pool.

## Results

Internal graded nDCG@10:

| Run | nDCG@10 | MAP | Precision@10 | Recall@10 | MRR | Status |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Refined PRF best | 0.3260 | 0.2699 | 0.2680 | 0.4469 | 0.5622 | prior lexical best |
| Field-sum cache | 0.3022 | 0.2452 | 0.2418 | 0.4136 | 0.5499 | baseline |
| LTR with Ollama features, 5-fold CV | 0.3164 | 0.2611 | 0.2551 | 0.4267 | 0.5395 | below PRF |
| LTR lexical/PRF features, 5-fold CV | 0.3166 | 0.2619 | 0.2520 | 0.4232 | 0.5558 | best CV, below PRF |
| LTR lexical/PRF features, in-sample | 0.3338 | 0.2750 | 0.2698 | 0.4470 | 0.5565 | capacity evidence only |
| Boosted-tree LTR, depth 3, 5-fold CV | 0.3216 | 0.2631 | 0.2564 | 0.4346 | 0.5434 | best LTR graded CV, below PRF |
| Boosted-tree LTR, depth 3, in-sample | 0.3564 | 0.2969 | 0.2680 | 0.4453 | 0.6242 | capacity evidence only |
| Coordinate LTR with BGE features, 5-fold CV | 0.3541 | 0.3025 | 0.2822 | 0.4773 | 0.5901 | above PRF |
| Boosted-tree LTR with BGE features, 5-fold CV | 0.3603 | 0.3026 | 0.2831 | 0.4804 | 0.5935 | best LTR graded CV |
| Boosted-tree LTR with BGE features, in-sample | 0.4053 | 0.3407 | 0.2987 | 0.5030 | 0.6821 | capacity evidence only |

Paper-style binary nDCG@20:

| Run | nDCG@20 | MAP | Precision@20 | Recall@20 | MRR | Status |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Paper-style refined PRF best | 0.4563 | 0.3016 | 0.1756 | 0.5559 | 0.5606 | prior lexical comparable best |
| Field-sum cache | 0.4319 | 0.2766 | 0.1647 | 0.5276 | 0.5531 | baseline |
| LTR with Ollama features, 5-fold CV | 0.4467 | 0.2942 | 0.1720 | 0.5452 | 0.5449 | below PRF |
| LTR lexical/PRF features, 5-fold CV | 0.4529 | 0.2998 | 0.1729 | 0.5470 | 0.5647 | best CV, below PRF |
| LTR lexical/PRF features, in-sample | 0.4607 | 0.3056 | 0.1767 | 0.5688 | 0.5520 | capacity evidence only |
| Boosted-tree LTR, depth 3, 5-fold CV | 0.4457 | 0.2925 | 0.1700 | 0.5433 | 0.5473 | below lexical LTR and PRF |
| Boosted-tree LTR, depth 3, in-sample | 0.4840 | 0.3281 | 0.1767 | 0.5633 | 0.6286 | capacity evidence only |
| Coordinate LTR with BGE features, 5-fold CV | 0.4857 | 0.3311 | 0.1847 | 0.5822 | 0.5732 | above PRF |
| Boosted-tree LTR with BGE features, 5-fold CV | 0.4910 | 0.3345 | 0.1842 | 0.5832 | 0.5959 | above PRF |
| Boosted-tree LTR with BGE features, in-sample | 0.5267 | 0.3708 | 0.1891 | 0.5931 | 0.6835 | capacity evidence only |

## Interpretation

LTR improves over field-sum under cross-validation, so the ranking problem is real and supervised features have useful signal. GEN-020 and GEN-021 did not beat refined PRF with lexical features or Ollama `llama3.1:8b` features. GEN-022 changes that result: dedicated BGE retrieval embeddings give LTR enough signal to beat refined PRF offline.

The cached Ollama `llama3.1:8b` embeddings did not help as LTR features:

- graded CV: lexical-only `0.3166` versus Ollama-feature `0.3164`
- binary CV: lexical-only `0.4529` versus Ollama-feature `0.4467`

The in-sample result exceeding refined PRF shows capacity, but also overfit risk. The next valid paths are:

GEN-021 pointwise boosted trees improved graded cross-validation from `0.3166` to `0.3216`, but still did not beat refined PRF `0.3260`. Binary cross-validation regressed versus lexical LTR. The very high in-sample boosted-tree numbers confirm capacity and overfit risk.

GEN-022 BGE features raise coordinate LTR to nDCG@10 `0.3541` and boosted-tree LTR to nDCG@10 `0.3603`. In binary comparison, BGE boosted-tree LTR reaches nDCG@20 `0.4910`, just below the simpler offline BGE hybrid depth-100 result `0.4915` and the remote OpenSearch BGE hybrid result `0.4926`.

The next valid paths are:

1. decide whether the simpler remote BGE hybrid is preferable to BGE LTR for the next architecture because binary performance is slightly better and implementation is simpler
2. validate transferability before promoting either candidate
3. refresh candidate pools at top-100 or top-200 before neural reranking if recall limits the ceiling
4. move to neural reranking for the top-50/top-100 pool if BGE hybrid transferability is not enough
