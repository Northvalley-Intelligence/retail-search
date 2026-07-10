# SE-0002 - Cranfield Failure Grouping And PRF Reranking

Status: prf-rerank candidate improved, not released
Mission: `M-0001`
Phase: Phase 1 - Cranfield Foundation
Dataset: Cranfield
Baseline architecture: `ARCH-0.1`
Candidate architecture: `ARCH-0.2-candidate`
Decision: `ADL-0002`
Related article: `A-0002`
Search endpoint: `/api/search` remains `ARCH-0.1` by default
Git tag: not assigned until candidate promotion
Candidate endpoint option: `/api/search?architecture=field-sum`
Candidate endpoint option: `/api/search?architecture=coverage-rerank`
Candidate endpoint option: `/api/search?architecture=prf-rerank`
Explain endpoint option: `/api/explain?architecture=field-sum`
Explain endpoint option: `/api/explain?architecture=coverage-rerank`
Explain endpoint option: `/api/explain?architecture=prf-rerank`

## Problem

The `ARCH-0.1` baseline used a single OpenSearch `multi_match` `best_fields` query. Live failure grouping showed that many misses were not just random low scores:

- 42 queries had a relevant result in top 10, but first relevant rank was below 3.
- 28 queries had no judged relevant result in top 10.
- 25 broad information needs had low recall.
- 23 queries had partial recall.

This suggested that aggregate metrics alone were hiding several different failure behaviors.

## Evaluation Technique Added

The evaluator now groups every Cranfield query by observed behavior:

- `zero_relevant_at_k`
- `late_first_relevant`
- `broad_need_low_recall`
- `lexical_noise_low_precision`
- `graded_ranking_loss`
- `partial_recall`
- `passing_or_minor`

Each detailed evaluation artifact keeps query-level evidence: retrieved IDs, relevant IDs retrieved, missing relevant IDs, first relevant rank, and behavior group.

## Architecture Attempts

### Rejected: query-rescue

Hypothesis: phrase/proximity boosts and all-keyword cross-field boosts would rescue zero-relevant or late-relevant queries.

Outcome: rejected because all core metrics regressed.

| Metric | Baseline | query-rescue | Delta |
| --- | ---: | ---: | ---: |
| MAP | 0.2402 | 0.2283 | -0.0119 |
| nDCG@10 | 0.2995 | 0.2904 | -0.0091 |
| Precision@10 | 0.2316 | 0.2222 | -0.0094 |
| Recall@10 | 0.3994 | 0.3882 | -0.0112 |
| MRR | 0.5350 | 0.5149 | -0.0201 |

### Improved Candidate: field-sum

Hypothesis: `best_fields` undercounts evidence when query terms are distributed across title, abstract, and text. Separate field-specific `match` clauses can add evidence across fields while preserving the same boosts.

Outcome: improved all core live Cranfield metrics.

| Metric | Baseline | field-sum | Delta |
| --- | ---: | ---: | ---: |
| MAP | 0.2402 | 0.2452 | +0.0050 |
| nDCG@10 | 0.2995 | 0.3022 | +0.0027 |
| Precision@10 | 0.2316 | 0.2418 | +0.0102 |
| Recall@10 | 0.3994 | 0.4136 | +0.0142 |
| MRR | 0.5350 | 0.5499 | +0.0149 |

### Next Problem Group: zero-relevant-at-10

`field-sum` improved aggregate metrics but left `zero_relevant_at_k` unchanged at 28 queries.

A top-50 drilldown of those 28 baseline zero-at-10 cases showed:

| Subgroup | Query count | Meaning |
| --- | ---: | --- |
| relevant_at_11_to_50 | 19 | Relevant evidence exists below rank 10; likely reranking problem. |
| absent_from_top_50 | 9 | Relevant evidence is not retrieved deeply; likely recall/vocabulary problem. |

This made reranking the next lower-risk candidate before adding broader expansion.

### Improved Candidate: coverage-rerank

Hypothesis: many zero-at-10 and late-first-relevant cases already have useful candidates in the retrieved set. A small title/abstract coverage bonus can promote documents that cover more significant query terms without overriding OpenSearch score.

Implementation:

- retrieve top 50 with `field-sum`
- normalize OpenSearch score within the retrieved set
- add a small title/abstract coverage bonus at weight `0.08`
- return the requested result count after reranking

Outcome: improved all core live Cranfield metrics over both the accepted baseline and `field-sum`.

| Metric | Baseline | field-sum | coverage-rerank | Delta vs baseline |
| --- | ---: | ---: | ---: | ---: |
| MAP | 0.2402 | 0.2452 | 0.2531 | +0.0129 |
| nDCG@10 | 0.2995 | 0.3022 | 0.3095 | +0.0100 |
| Precision@10 | 0.2316 | 0.2418 | 0.2502 | +0.0186 |
| Recall@10 | 0.3994 | 0.4136 | 0.4283 | +0.0289 |
| MRR | 0.5350 | 0.5499 | 0.5520 | +0.0170 |

Direct delta over `field-sum`:

| Metric | field-sum | coverage-rerank | Delta |
| --- | ---: | ---: | ---: |
| MAP | 0.2452 | 0.2531 | +0.0079 |
| nDCG@10 | 0.3022 | 0.3095 | +0.0073 |
| Precision@10 | 0.2418 | 0.2502 | +0.0084 |
| Recall@10 | 0.4136 | 0.4283 | +0.0147 |
| MRR | 0.5499 | 0.5520 | +0.0021 |

### Research-Informed Candidate: prf-rerank

Research finding: I did not find a reliable public primary-source leaderboard for highest Cranfield nDCG@10. The strongest reusable pattern from reproducible IR references was sparse BM25 retrieval followed by multi-stage reranking and pseudo-relevance feedback.

Hypothesis: top-ranked field-sum hits contain useful vocabulary for Cranfield's long technical queries. Deriving a small set of feedback terms from those top hits should help vocabulary mismatch and late-ranking failures without adding semantic search or an LLM.

Implementation:

- retrieve top 50 with `field-sum`
- treat the top 4 titles and abstracts as pseudo-relevant feedback
- extract 8 feedback terms
- rerank with normalized OpenSearch score plus original-query coverage, feedback-term coverage, and a small adjacent-query-phrase coherence bonus

Outcome: improved all core live Cranfield metrics over baseline, field-sum, and coverage-rerank. GEN-016 refined this candidate with phrase coherence and improved it again.

| Metric | Baseline | coverage-rerank | refined prf-rerank | Delta vs baseline |
| --- | ---: | ---: | ---: | ---: |
| MAP | 0.2402 | 0.2531 | 0.2699 | +0.0297 |
| nDCG@10 | 0.2995 | 0.3095 | 0.3260 | +0.0265 |
| Precision@10 | 0.2316 | 0.2502 | 0.2680 | +0.0364 |
| Recall@10 | 0.3994 | 0.4283 | 0.4469 | +0.0475 |
| MRR | 0.5350 | 0.5520 | 0.5622 | +0.0272 |

Direct delta over `coverage-rerank`:

| Metric | coverage-rerank | refined prf-rerank | Delta |
| --- | ---: | ---: | ---: |
| MAP | 0.2531 | 0.2699 | +0.0168 |
| nDCG@10 | 0.3095 | 0.3260 | +0.0165 |
| Precision@10 | 0.2502 | 0.2680 | +0.0178 |
| Recall@10 | 0.4283 | 0.4469 | +0.0186 |
| MRR | 0.5520 | 0.5622 | +0.0102 |

### GEN-016 Next Optimization

Two next-step candidates were tested:

- `prf-expand-rerank`: a second feedback-expanded retrieval pass over OpenSearch. This regressed nDCG@10 to 0.3219 and is rejected.
- refined `prf-rerank`: same PRF settings plus adjacent-query-phrase coherence weight 0.01. This improved nDCG@10 to 0.3260 and is the best current Cranfield candidate.

### Paper-BM25 Comparability Check

The operator pointed to Ghasemi and Hiemstra's Cranfield BERT paper, which reports NDCG@20 instead of this project's internal nDCG@10 ladder. GEN-014 added comparable binary relevance evaluation and a separate paper-style BM25 index profile using `k1=1.5` and `b=0.75`.

Local comparable results:

| Run | MAP | NDCG@20 | Precision@20 | Recall@20 | MRR |
| --- | ---: | ---: | ---: | ---: | ---: |
| Default BM25 baseline | 0.2676 | 0.4187 | 0.1562 | 0.5069 | 0.5375 |
| Default refined PRF rerank | 0.2993 | 0.4546 | 0.1749 | 0.5533 | 0.5641 |
| Paper-style BM25 baseline | 0.2700 | 0.4196 | 0.1564 | 0.5055 | 0.5393 |
| Paper-style BM25 plus refined PRF rerank | 0.3016 | 0.4563 | 0.1756 | 0.5559 | 0.5606 |

External reference from "BERT meets Cranfield":

| Method | NDCG@20 |
| --- | ---: |
| BM25 | 0.4714 |
| BERT re-ranker | 0.5525 |
| BERT full-ranker | 0.5670 |

Interpretation: PRF rerank improved the local OpenSearch baseline but still trails the paper's BM25 result and is far below the paper's supervised BERT rankers. Reaching those BERT results likely requires a supervised neural reranker or full-ranker, not just OpenSearch-native reranking.

## Evidence

Commands:

```bash
npm run eval:cranfield -- --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/evaluation-live-baseline-gen011.json --summary --details --retrieve-size 50 --concurrency 10 --architecture baseline
npm run eval:cranfield -- --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/evaluation-live-query-rescue-gen011.json --summary --details --retrieve-size 50 --concurrency 10 --architecture query-rescue
npm run eval:cranfield -- --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/evaluation-live-field-sum-gen011.json --summary --details --retrieve-size 50 --concurrency 10 --architecture field-sum
npm run compare:cranfield -- --baseline experiments/cranfield-v0/evaluation-live-baseline-gen011.json --candidate experiments/cranfield-v0/evaluation-live-query-rescue-gen011.json --candidate experiments/cranfield-v0/evaluation-live-field-sum-gen011.json --write experiments/cranfield-v0/evaluation-comparison-gen011.json --summary --top 8
npm run eval:cranfield -- --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/evaluation-live-coverage-rerank-gen012.json --summary --details --retrieve-size 50 --concurrency 10 --architecture coverage-rerank
npm run compare:cranfield -- --baseline experiments/cranfield-v0/evaluation-live-baseline-gen011.json --candidate experiments/cranfield-v0/evaluation-live-field-sum-gen011.json --candidate experiments/cranfield-v0/evaluation-live-coverage-rerank-gen012.json --write experiments/cranfield-v0/evaluation-comparison-gen012.json --summary --top 8
npm run eval:cranfield -- --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/evaluation-live-prf-rerank-gen013.json --summary --details --retrieve-size 50 --concurrency 10 --architecture prf-rerank
npm run compare:cranfield -- --baseline experiments/cranfield-v0/evaluation-live-baseline-gen011.json --candidate experiments/cranfield-v0/evaluation-live-coverage-rerank-gen012.json --candidate experiments/cranfield-v0/evaluation-live-prf-rerank-gen013.json --write experiments/cranfield-v0/evaluation-comparison-gen013.json --summary --top 8
CRANFIELD_INDEX=cranfield-v0-paper-bm25 npm run eval:cranfield -- --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/evaluation-live-paper-bm25-prf-k20-binary-gen014.json --summary --details --k 20 --retrieve-size 50 --concurrency 10 --architecture prf-rerank --relevance-mode binary
node scripts/tune-cranfield-prf.mjs --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/prf-phrase-tuning-gen016.json --top 8
npm run eval:cranfield -- --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/evaluation-live-prf-rerank-phrase-gen016.json --summary --details --retrieve-size 50 --concurrency 10 --architecture prf-rerank
npm run compare:cranfield -- --baseline experiments/cranfield-v0/evaluation-live-prf-rerank-gen013.json --candidate experiments/cranfield-v0/evaluation-live-prf-rerank-phrase-gen016.json --candidate experiments/cranfield-v0/evaluation-live-prf-expand-rerank-gen016.json --write experiments/cranfield-v0/evaluation-comparison-gen016.json --summary --top 12
npm run cache:cranfield -- --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --architecture field-sum --retrieve-size 50 --concurrency 10 --summary
npm run tune:cranfield:prf -- --retrieval-cache experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json --write experiments/cranfield-v0/prf-phrase-tuning-from-cache-gen017.json --top 8
```

Artifacts:

- `docs/evaluation/cranfield-failure-groups.md`
- `experiments/cranfield-v0/evaluation-live-baseline-gen011.json`
- `experiments/cranfield-v0/evaluation-live-query-rescue-gen011.json`
- `experiments/cranfield-v0/evaluation-live-field-sum-gen011.json`
- `experiments/cranfield-v0/evaluation-live-coverage-rerank-gen012.json`
- `experiments/cranfield-v0/evaluation-live-prf-rerank-gen013.json`
- `experiments/cranfield-v0/evaluation-comparison-gen011.json`
- `experiments/cranfield-v0/evaluation-comparison-gen012.json`
- `experiments/cranfield-v0/evaluation-comparison-gen013.json`
- `experiments/cranfield-v0/evaluation-comparison-k20-binary-gen014.json`
- `experiments/cranfield-v0/evaluation-live-baseline-k20-binary-gen014.json`
- `experiments/cranfield-v0/evaluation-live-prf-rerank-k20-binary-gen014.json`
- `experiments/cranfield-v0/evaluation-live-paper-bm25-baseline-k20-binary-gen014.json`
- `experiments/cranfield-v0/evaluation-live-paper-bm25-prf-k20-binary-gen014.json`
- `experiments/cranfield-v0/evaluation-live-prf-expand-rerank-gen016.json`
- `experiments/cranfield-v0/evaluation-live-prf-rerank-phrase-gen016.json`
- `experiments/cranfield-v0/evaluation-live-prf-rerank-phrase-k20-binary-gen016.json`
- `experiments/cranfield-v0/evaluation-live-paper-bm25-prf-phrase-k20-binary-gen016.json`
- `experiments/cranfield-v0/evaluation-comparison-gen016.json`
- `experiments/cranfield-v0/prf-phrase-tuning-gen016.json`
- `experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json`
- `experiments/cranfield-v0/prf-phrase-tuning-from-cache-gen017.json`
- `docs/evaluation/cranfield-prf-rerank-research.md`
- `docs/evaluation/timeline.md`

## Fast Loop Workflow

GEN-017 adds a cached retrieval-pool workflow for reranker experiments:

1. Refresh the first-stage retrieval pool from remote OpenSearch only when the index, analyzer, first-stage architecture, query set, or retrieve depth changes.
2. Tune deterministic rerankers offline from the cached pool.
3. Run full remote OpenSearch evaluation only for winners that beat the current best candidate offline.

## Decision

Do not replace the public default yet.

Refined `prf-rerank` is retained as the best current Cranfield candidate and should be carried into the Phase 2 BEIR transferability gate. `field-sum` remains the retrieval floor inside coverage-rerank and prf-rerank. `query-rescue` and `prf-expand-rerank` remain preserved as rejected evidence.

## Rollback

No rollback is needed because the public default remains `ARCH-0.1` unless callers explicitly request a candidate architecture in the local/API path.
