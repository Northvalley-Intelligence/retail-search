# ADL-0002 - Keep PRF Rerank As A Cranfield Candidate

Status: candidate improved, deferred for transferability
Mission: `M-0001`
Search Evolution: `SE-0002`
Architecture version: `ARCH-0.2-candidate`
Dataset: Cranfield
Related article: `A-0002`
Related artifacts:

- `docs/evaluation/cranfield-failure-groups.md`
- `experiments/cranfield-v0/evaluation-comparison-gen011.json`
- `experiments/cranfield-v0/evaluation-live-field-sum-gen011.json`
- `experiments/cranfield-v0/evaluation-live-coverage-rerank-gen012.json`
- `experiments/cranfield-v0/evaluation-comparison-gen012.json`
- `experiments/cranfield-v0/evaluation-live-prf-rerank-gen013.json`
- `experiments/cranfield-v0/evaluation-comparison-gen013.json`
- `experiments/cranfield-v0/evaluation-live-baseline-k20-binary-gen014.json`
- `experiments/cranfield-v0/evaluation-live-prf-rerank-k20-binary-gen014.json`
- `experiments/cranfield-v0/evaluation-live-paper-bm25-baseline-k20-binary-gen014.json`
- `experiments/cranfield-v0/evaluation-live-paper-bm25-prf-k20-binary-gen014.json`
- `experiments/cranfield-v0/evaluation-comparison-k20-binary-gen014.json`
- `experiments/cranfield-v0/evaluation-live-prf-rerank-phrase-gen016.json`
- `experiments/cranfield-v0/evaluation-live-prf-expand-rerank-gen016.json`
- `experiments/cranfield-v0/evaluation-comparison-gen016.json`
- `experiments/cranfield-v0/evaluation-live-paper-bm25-prf-phrase-k20-binary-gen016.json`
- `experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json`
- `experiments/cranfield-v0/prf-phrase-tuning-from-cache-gen017.json`
- `docs/evaluation/cranfield-prf-rerank-research.md`
- `docs/evaluation/timeline.md`

## Problem

The accepted `ARCH-0.1` OpenSearch BM25 baseline is transparent, but live Cranfield evaluation showed multiple failure behaviors hidden by aggregate metrics:

- no relevant result in top 10
- first relevant result ranked too late
- broad information needs with low recall
- lexical noise with low precision
- weak graded ranking
- partial recall

The first architecture question was whether a small OpenSearch-only query change could improve one group without introducing agents, LTR, semantic search, or runtime LLM calls.

## Evidence

Baseline live metrics:

| Metric | Value |
| --- | ---: |
| MAP | 0.2402 |
| nDCG@10 | 0.2995 |
| Precision@10 | 0.2316 |
| Recall@10 | 0.3994 |
| MRR | 0.5350 |

The first attempted candidate, `query-rescue`, added phrase/proximity and all-keyword boosts. It was rejected because all core metrics regressed.

The second candidate, `field-sum`, replaced the single `best_fields` multi_match with separate boosted `match` clauses for title, abstract, and text. This allows evidence from multiple fields to add together instead of selecting only the best matching field.

Field-sum live result:

| Metric | Baseline | Field sum | Delta |
| --- | ---: | ---: | ---: |
| MAP | 0.2402 | 0.2452 | +0.0050 |
| nDCG@10 | 0.2995 | 0.3022 | +0.0027 |
| Precision@10 | 0.2316 | 0.2418 | +0.0102 |
| Recall@10 | 0.3994 | 0.4136 | +0.0142 |
| MRR | 0.5350 | 0.5499 | +0.0149 |

Field-sum also reduced several failure groups:

- late-first-relevant cases: 42 -> 38
- lexical-noise-low-precision cases: 27 -> 22
- graded-ranking-loss cases: 16 -> 12
- passing-or-minor cases: 64 -> 68

It did not fix zero-relevant cases: 28 -> 28.

The next targeted drilldown found that 19 of the 28 baseline zero-at-10 queries had a judged relevant document between ranks 11 and 50, while 9 had no relevant result in the top 50. That made lightweight reranking a lower-risk next candidate than broad query expansion.

The third candidate, `coverage-rerank`, retrieves the top 50 with field-sum, normalizes OpenSearch score within that retrieved set, and adds a small deterministic title/abstract coverage bonus for significant query terms before returning the requested result count.

Coverage-rerank live result:

| Metric | Baseline | Field sum | Coverage rerank | Delta vs baseline |
| --- | ---: | ---: | ---: | ---: |
| MAP | 0.2402 | 0.2452 | 0.2531 | +0.0129 |
| nDCG@10 | 0.2995 | 0.3022 | 0.3095 | +0.0100 |
| Precision@10 | 0.2316 | 0.2418 | 0.2502 | +0.0186 |
| Recall@10 | 0.3994 | 0.4136 | 0.4283 | +0.0289 |
| MRR | 0.5350 | 0.5499 | 0.5520 | +0.0170 |

The fourth candidate, `prf-rerank`, adapts pseudo-relevance feedback: retrieve the top 50 with field-sum, extract feedback terms from the top four titles and abstracts, and rerank with original-query coverage, feedback-term coverage, and a small phrase-coherence bonus.

Refined PRF-rerank live result:

| Metric | Baseline | Coverage rerank | Refined PRF rerank | Delta vs baseline |
| --- | ---: | ---: | ---: | ---: |
| MAP | 0.2402 | 0.2531 | 0.2699 | +0.0297 |
| nDCG@10 | 0.2995 | 0.3095 | 0.3260 | +0.0265 |
| Precision@10 | 0.2316 | 0.2502 | 0.2680 | +0.0364 |
| Recall@10 | 0.3994 | 0.4283 | 0.4469 | +0.0475 |
| MRR | 0.5350 | 0.5520 | 0.5622 | +0.0272 |

GEN-014 added binary NDCG@20 evaluation and a separate paper-style BM25 index profile for comparison with Ghasemi and Hiemstra's Cranfield BERT paper:

| Run | NDCG@20 |
| --- | ---: |
| Default BM25 baseline | 0.4187 |
| Default refined PRF rerank | 0.4546 |
| Paper-style BM25 baseline | 0.4196 |
| Paper-style BM25 plus refined PRF rerank | 0.4563 |
| External paper BM25 | 0.4714 |
| External paper BERT re-ranker | 0.5525 |
| External paper BERT full-ranker | 0.5670 |

## Alternatives Considered

1. Keep `ARCH-0.1` unchanged.
   - Rejected as the only next step because failure grouping showed diagnosable search behaviors worth testing.

2. Query rescue with phrase/proximity and all-keyword boost clauses.
   - Rejected because metrics regressed.

3. Field-sum query with separate field-specific clauses.
   - Kept as an improved candidate and as the retrieval floor for the next candidate.

4. Coverage rerank over field-sum top-50 candidates.
   - Kept as improved evidence, but superseded by PRF rerank.

5. Pseudo-relevance-feedback rerank over field-sum top-50 candidates.
   - Selected as the best current Cranfield candidate because all core metrics improved over baseline, field-sum, and coverage-rerank.

6. Paper-style BM25 index parameters.
   - Kept as comparison evidence only because BM25 `k1=1.5`, `b=0.75` barely moved the local NDCG@20 baseline.

7. PRF-expanded second retrieval.
   - Rejected because it regressed all core metrics against PRF rerank.

8. PRF phrase-coherence refinement.
   - Selected because a small adjacent-query-phrase bonus improved all core metrics against the prior PRF rerank.

9. Cached first-stage retrieval pools for reranker tuning.
   - Selected as the preferred experiment workflow because it reproduces reranker metrics without repeated remote OpenSearch calls. It does not change ranking behavior by itself.

## Decision

Keep refined `prf-rerank` as the best current candidate architecture for the next transferability gate.

Do not promote it to the public default architecture yet. Phase 2 must test whether the improvement transfers beyond Cranfield before it becomes an accepted cumulative architecture version.

## Measured Impact

Positive:

- MAP +0.0297
- nDCG@10 +0.0265
- Precision@10 +0.0364
- Recall@10 +0.0475
- MRR +0.0272

Negative or unresolved:

- 72 queries worsened by nDCG@10 versus the accepted baseline.
- Zero-relevant top-10 cases improved: 28 -> 23.
- Broad-need-low-recall and partial-recall group counts increased because some queries moved between failure classes.
- No BEIR transferability evidence exists yet.

## Validation History

- `npm run validate`: passed locally with 23 tests after evaluator and architecture changes.
- Live baseline evaluation: passed over 225 Cranfield queries.
- Live query-rescue evaluation: passed but regressed metrics.
- Live field-sum evaluation: passed and improved metrics.
- Live coverage-rerank evaluation: passed and improved metrics over baseline and field-sum.
- Live prf-rerank evaluation: passed and improved metrics over baseline and coverage-rerank.
- Live prf-rerank phrase refinement evaluation: passed and improved metrics over the prior PRF rerank.
- Live prf-expand-rerank evaluation: passed but regressed metrics, so it is rejected.
- Evaluation comparison artifacts: `experiments/cranfield-v0/evaluation-comparison-gen011.json`, `experiments/cranfield-v0/evaluation-comparison-gen012.json`, `experiments/cranfield-v0/evaluation-comparison-gen013.json`.
- GEN-016 comparison artifact: `experiments/cranfield-v0/evaluation-comparison-gen016.json`.
- Paper-comparable artifacts: `experiments/cranfield-v0/evaluation-live-paper-bm25-prf-k20-binary-gen014.json` and `docs/evaluation/timeline.md`.
- Cached fast-loop artifacts: `experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json` and `experiments/cranfield-v0/prf-phrase-tuning-from-cache-gen017.json`.

## Scope

Project-local Cranfield experiment only.

The production default remains the accepted `ARCH-0.1` baseline. Candidate paths are opt-in through `architecture=field-sum`, `architecture=coverage-rerank`, or `architecture=prf-rerank` and are not deployed as default behavior changes in this generation.

GEN-017 cache artifacts are evaluation infrastructure. They are valid only while the source index, analyzer, first-stage architecture, query set, and retrieve depth match the cached metadata.
