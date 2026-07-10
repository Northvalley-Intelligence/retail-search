# Cranfield Failure Behavior Groups

Status: live evaluated on 2026-07-07
Mission: `M-0001`
Baseline Search Evolution: `SE-0001`
Experiment Search Evolution: `SE-0002`
Baseline architecture: `ARCH-0.1`
Candidate architecture: `ARCH-0.2-candidate`
Decision: `ADL-0002`

## Purpose

The Phase 1 baseline originally reported aggregate Cranfield metrics only. GEN-011 adds behavior grouping so failed queries can be inspected by observed retrieval pattern before changing architecture.

The evaluator now records, per query:

- relevant document IDs from qrels
- top-K retrieved IDs
- relevant hits in top K
- missing relevant IDs
- first relevant rank
- behavior group

Metrics are still calculated at `k=10`. The live diagnostic runs retrieved 50 results so the artifacts can inspect deeper ranking behavior while preserving the original top-10 metric convention.

## Baseline Groups

Command:

```bash
npm run eval:cranfield -- --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/evaluation-live-baseline-gen011.json --summary --details --retrieve-size 50 --concurrency 10 --architecture baseline
```

Baseline metrics:

| Metric | Value |
| --- | ---: |
| MAP | 0.2402 |
| nDCG@10 | 0.2995 |
| Precision@10 | 0.2316 |
| Recall@10 | 0.3994 |
| MRR | 0.5350 |

Baseline behavior groups:

| Group | Query count | Behavior |
| --- | ---: | --- |
| passing_or_minor | 64 | Not classified as a meaningful failure |
| late_first_relevant | 42 | First relevant result exists, but below rank 3 |
| zero_relevant_at_k | 28 | No judged relevant result in top 10 |
| lexical_noise_low_precision | 27 | Some relevance, but top 10 is mostly non-relevant |
| broad_need_low_recall | 25 | Many relevant documents exist, but few are captured |
| partial_recall | 23 | Hits exist, but most relevant documents are missed |
| graded_ranking_loss | 16 | Relevant hits exist, but graded ranking is weak |

## Candidate Attempts

### Query Rescue Candidate

Architecture id: `query-rescue`
Targeted groups: `zero_relevant_at_k`, `late_first_relevant`, `lexical_noise_low_precision`

Technique:

- keep the baseline BM25 recall clause
- add phrase/proximity boosts
- add cross-field all-keyword boosts
- add a 70 percent minimum-match boost clause

Result: rejected for this generation because core metrics regressed.

| Metric | Baseline | Query rescue | Delta |
| --- | ---: | ---: | ---: |
| MAP | 0.2402 | 0.2283 | -0.0119 |
| nDCG@10 | 0.2995 | 0.2904 | -0.0091 |
| Precision@10 | 0.2316 | 0.2222 | -0.0094 |
| Recall@10 | 0.3994 | 0.3882 | -0.0112 |
| MRR | 0.5350 | 0.5149 | -0.0201 |

### Field Sum Candidate

Architecture id: `field-sum`
Targeted groups: `late_first_relevant`, `broad_need_low_recall`, `partial_recall`

Technique:

- replace the single `best_fields` multi_match with separate boosted `match` clauses for `title`, `abstract`, and `text`
- keep the same field weights: title `3x`, abstract `2x`, text `1x`
- require at least one field to match
- allow matching evidence from multiple fields to add together

Result: improved all core live Cranfield metrics, but remains candidate-only until transferability is tested in Phase 2.

| Metric | Baseline | Field sum | Delta |
| --- | ---: | ---: | ---: |
| MAP | 0.2402 | 0.2452 | +0.0050 |
| nDCG@10 | 0.2995 | 0.3022 | +0.0027 |
| Precision@10 | 0.2316 | 0.2418 | +0.0102 |
| Recall@10 | 0.3994 | 0.4136 | +0.0142 |
| MRR | 0.5350 | 0.5499 | +0.0149 |

Field-sum behavior shifts:

| Group | Baseline | Field sum | Delta |
| --- | ---: | ---: | ---: |
| passing_or_minor | 64 | 68 | +4 |
| late_first_relevant | 42 | 38 | -4 |
| lexical_noise_low_precision | 27 | 22 | -5 |
| graded_ranking_loss | 16 | 12 | -4 |
| zero_relevant_at_k | 28 | 28 | 0 |
| broad_need_low_recall | 25 | 28 | +3 |
| partial_recall | 23 | 29 | +6 |

Query-level movement:

| Candidate | Improved queries | Worsened queries | Unchanged queries |
| --- | ---: | ---: | ---: |
| query-rescue | 39 | 57 | 129 |
| field-sum | 99 | 77 | 49 |

### Zero-Relevant Drilldown

The next group inspected was `zero_relevant_at_k`, because `field-sum` did not reduce it.

Live baseline top-50 retrieval showed:

| Subgroup | Query count | Meaning |
| --- | ---: | --- |
| relevant_at_11_to_50 | 19 | A judged relevant document exists below rank 10, so this is mostly a ranking problem. |
| absent_from_top_50 | 9 | No judged relevant document appears in the top 50, so this is a deeper recall/vocabulary problem. |

This split suggested testing a lightweight rerank over the retrieved set before attempting broader query expansion.

### Coverage Rerank Candidate

Architecture id: `coverage-rerank`
Targeted groups: `zero_relevant_at_k`, `late_first_relevant`, `lexical_noise_low_precision`

Technique:

- retrieve the top 50 with the `field-sum` candidate
- normalize OpenSearch score within the retrieved set
- add a small deterministic title/abstract query-term coverage bonus
- return the requested result count after reranking
- keep the public default unchanged

Result: improved all core live Cranfield metrics over both the accepted baseline and the earlier field-sum candidate.

| Metric | Baseline | Field sum | Coverage rerank | Delta vs baseline |
| --- | ---: | ---: | ---: | ---: |
| MAP | 0.2402 | 0.2452 | 0.2531 | +0.0129 |
| nDCG@10 | 0.2995 | 0.3022 | 0.3095 | +0.0100 |
| Precision@10 | 0.2316 | 0.2418 | 0.2502 | +0.0186 |
| Recall@10 | 0.3994 | 0.4136 | 0.4283 | +0.0289 |
| MRR | 0.5350 | 0.5499 | 0.5520 | +0.0170 |

Coverage-rerank behavior shifts against the accepted baseline:

| Group | Baseline | Coverage rerank | Delta |
| --- | ---: | ---: | ---: |
| passing_or_minor | 64 | 69 | +5 |
| late_first_relevant | 42 | 34 | -8 |
| lexical_noise_low_precision | 27 | 22 | -5 |
| zero_relevant_at_k | 28 | 27 | -1 |
| broad_need_low_recall | 25 | 28 | +3 |
| partial_recall | 23 | 29 | +6 |
| graded_ranking_loss | 16 | 16 | 0 |

Query-level movement:

| Candidate | Improved queries | Worsened queries | Unchanged queries |
| --- | ---: | ---: | ---: |
| field-sum | 99 | 77 | 49 |
| coverage-rerank | 109 | 69 | 47 |

### PRF Rerank Candidate

Architecture id: `prf-rerank`
Targeted groups: `zero_relevant_at_k`, `late_first_relevant`, `lexical_noise_low_precision`, `partial_recall`

Technique:

- retrieve the top 50 with `field-sum`
- treat the top 4 returned titles and abstracts as pseudo-relevant feedback
- extract 8 feedback terms
- rerank with normalized OpenSearch score, original query coverage, feedback-term coverage, and a small phrase-coherence bonus
- keep the public default unchanged

Result: improved all core live Cranfield metrics over baseline, field-sum, and coverage-rerank.

| Metric | Baseline | Coverage rerank | Refined PRF rerank | Delta vs baseline |
| --- | ---: | ---: | ---: | ---: |
| MAP | 0.2402 | 0.2531 | 0.2699 | +0.0297 |
| nDCG@10 | 0.2995 | 0.3095 | 0.3260 | +0.0265 |
| Precision@10 | 0.2316 | 0.2502 | 0.2680 | +0.0364 |
| Recall@10 | 0.3994 | 0.4283 | 0.4469 | +0.0475 |
| MRR | 0.5350 | 0.5520 | 0.5622 | +0.0272 |

PRF-rerank behavior shifts against the accepted baseline:

| Group | Baseline | PRF rerank | Delta |
| --- | ---: | ---: | ---: |
| passing_or_minor | 64 | 83 | +19 |
| late_first_relevant | 42 | 40 | -2 |
| zero_relevant_at_k | 28 | 23 | -5 |
| lexical_noise_low_precision | 27 | 21 | -6 |
| broad_need_low_recall | 25 | 29 | +4 |
| partial_recall | 23 | 16 | -7 |
| graded_ranking_loss | 16 | 13 | -3 |

Query-level movement:

| Candidate | Improved queries | Worsened queries | Unchanged queries |
| --- | ---: | ---: | ---: |
| coverage-rerank | 109 | 69 | 47 |
| prf-rerank | 127 | 72 | 26 |

## Evidence Artifacts

- Baseline: `experiments/cranfield-v0/evaluation-live-baseline-gen011.json`
- Query rescue candidate: `experiments/cranfield-v0/evaluation-live-query-rescue-gen011.json`
- Field sum candidate: `experiments/cranfield-v0/evaluation-live-field-sum-gen011.json`
- Coverage rerank candidate: `experiments/cranfield-v0/evaluation-live-coverage-rerank-gen012.json`
- PRF rerank candidate: `experiments/cranfield-v0/evaluation-live-prf-rerank-gen013.json`
- Refined PRF rerank candidate: `experiments/cranfield-v0/evaluation-live-prf-rerank-phrase-gen016.json`
- Rejected PRF expanded retrieval candidate: `experiments/cranfield-v0/evaluation-live-prf-expand-rerank-gen016.json`
- GEN-011 comparison: `experiments/cranfield-v0/evaluation-comparison-gen011.json`
- GEN-012 comparison: `experiments/cranfield-v0/evaluation-comparison-gen012.json`
- GEN-013 comparison: `experiments/cranfield-v0/evaluation-comparison-gen013.json`
- GEN-016 comparison: `experiments/cranfield-v0/evaluation-comparison-gen016.json`

Comparison command:

```bash
npm run compare:cranfield -- --baseline experiments/cranfield-v0/evaluation-live-baseline-gen011.json --candidate experiments/cranfield-v0/evaluation-live-query-rescue-gen011.json --candidate experiments/cranfield-v0/evaluation-live-field-sum-gen011.json --write experiments/cranfield-v0/evaluation-comparison-gen011.json --summary --top 8
npm run eval:cranfield -- --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/evaluation-live-coverage-rerank-gen012.json --summary --details --retrieve-size 50 --concurrency 10 --architecture coverage-rerank
npm run compare:cranfield -- --baseline experiments/cranfield-v0/evaluation-live-baseline-gen011.json --candidate experiments/cranfield-v0/evaluation-live-field-sum-gen011.json --candidate experiments/cranfield-v0/evaluation-live-coverage-rerank-gen012.json --write experiments/cranfield-v0/evaluation-comparison-gen012.json --summary --top 8
npm run eval:cranfield -- --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/evaluation-live-prf-rerank-gen013.json --summary --details --retrieve-size 50 --concurrency 10 --architecture prf-rerank
npm run compare:cranfield -- --baseline experiments/cranfield-v0/evaluation-live-baseline-gen011.json --candidate experiments/cranfield-v0/evaluation-live-coverage-rerank-gen012.json --candidate experiments/cranfield-v0/evaluation-live-prf-rerank-gen013.json --write experiments/cranfield-v0/evaluation-comparison-gen013.json --summary --top 8
npm run eval:cranfield -- --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/evaluation-live-prf-rerank-phrase-gen016.json --summary --details --retrieve-size 50 --concurrency 10 --architecture prf-rerank
npm run compare:cranfield -- --baseline experiments/cranfield-v0/evaluation-live-prf-rerank-gen013.json --candidate experiments/cranfield-v0/evaluation-live-prf-rerank-phrase-gen016.json --candidate experiments/cranfield-v0/evaluation-live-prf-expand-rerank-gen016.json --write experiments/cranfield-v0/evaluation-comparison-gen016.json --summary --top 12
```

## Decision

Refined `prf-rerank` is the current best Cranfield candidate. It should not replace the public default or become an accepted architecture version until the Phase 2 BEIR transferability gate shows the same pattern holds outside Cranfield.

`query-rescue` is retained as rejected evidence because it looked plausible by behavior-group hypothesis but made the measured system worse.

`field-sum` remains useful as the retrieval floor under `coverage-rerank` and `prf-rerank`.
