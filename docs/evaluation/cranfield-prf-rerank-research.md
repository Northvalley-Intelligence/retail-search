# Cranfield PRF Rerank Research Notes

Status: live evaluated on 2026-07-07
Mission: `M-0001`
Search Evolution: `SE-0002`
Candidate architecture: `ARCH-0.2-candidate`
Candidate id: `prf-rerank`

## Research Finding

I did not find a reliable primary-source public leaderboard for "highest nDCG@10 on Cranfield." The Cranfield source page provides the 1,400-document collection, queries, and relevance assessments, but not a modern leaderboard.

The strongest portable implementation pattern from primary IR references was not a Cranfield-specific score to copy. It was:

- sparse BM25 first-stage retrieval
- multi-stage reranking
- query expansion or pseudo-relevance feedback
- careful reproducible evaluation with qrels

Sources reviewed:

- Glasgow Cranfield collection: `https://ir.dcs.gla.ac.uk/resources/test_collections/cran/`
- Stanford IR book, relevance feedback and query expansion: `https://nlp.stanford.edu/IR-book/html/htmledition/relevance-feedback-and-query-expansion-1.html`
- Pyserini reproducible sparse/dense retrieval toolkit: `https://arxiv.org/abs/2102.10073`
- BRIGHT reproducible baselines, including query-side BM25 for long queries: `https://arxiv.org/abs/2509.02558`

## Candidate Imported

`prf-rerank` adapts the pseudo-relevance-feedback pattern without adding a new index, neural model, or runtime LLM:

1. Retrieve top 50 with the current `field-sum` BM25 candidate.
2. Treat the top 4 hits as pseudo-relevant feedback documents.
3. Extract 8 feedback terms from their titles and abstracts.
4. Rerank the top 50 using normalized OpenSearch score plus original-query and feedback-term title/abstract coverage.
5. Add a small adjacent-query-phrase coherence bonus at weight 0.01.
6. Return the requested result count.

Runtime constants:

| Setting | Value |
| --- | ---: |
| retrieve size | 50 |
| feedback documents | 4 |
| feedback terms | 8 |
| original query coverage weight | 0.06 |
| feedback term coverage weight | 0.14 |
| phrase coherence weight | 0.01 |

## Live Result

| Metric | Baseline | Coverage rerank | Refined PRF rerank | Delta vs baseline |
| --- | ---: | ---: | ---: | ---: |
| MAP | 0.2402 | 0.2531 | 0.2699 | +0.0297 |
| nDCG@10 | 0.2995 | 0.3095 | 0.3260 | +0.0265 |
| Precision@10 | 0.2316 | 0.2502 | 0.2680 | +0.0364 |
| Recall@10 | 0.3994 | 0.4283 | 0.4469 | +0.0475 |
| MRR | 0.5350 | 0.5520 | 0.5622 | +0.0272 |

PRF rerank also improved over coverage-rerank:

| Metric | Coverage rerank | Refined PRF rerank | Delta |
| --- | ---: | ---: | ---: |
| MAP | 0.2531 | 0.2699 | +0.0168 |
| nDCG@10 | 0.3095 | 0.3260 | +0.0165 |
| Precision@10 | 0.2502 | 0.2680 | +0.0178 |
| Recall@10 | 0.4283 | 0.4469 | +0.0186 |
| MRR | 0.5520 | 0.5622 | +0.0102 |

## Decision

Refined `prf-rerank` is the best live lexical Cranfield candidate. GEN-022 later produced stronger offline BGE vector/hybrid evidence, and GEN-023 validated that path in remote OpenSearch. BGE still needs transferability and promotion policy before release.

It remains candidate-only because:

- the public default must stay `ARCH-0.1`
- the method is tuned on Cranfield evidence
- Phase 2 BEIR transferability is required before promotion

Evidence:

- `experiments/cranfield-v0/evaluation-live-prf-rerank-gen013.json`
- `experiments/cranfield-v0/evaluation-comparison-gen013.json`

## Paper-Comparable Check

The Cranfield BERT paper reports NDCG@20, not this project's internal graded nDCG@10 ladder. GEN-014 added binary relevance evaluation and a separate paper-style BM25 index profile using BM25 `k1=1.5`, `b=0.75`.

| Run | NDCG@20 |
| --- | ---: |
| Default BM25 baseline | 0.4187 |
| Default refined PRF rerank | 0.4546 |
| Paper-style BM25 baseline | 0.4196 |
| Paper-style BM25 plus refined PRF rerank | 0.4563 |
| External paper BM25 | 0.4714 |
| External paper BERT re-ranker | 0.5525 |
| External paper BERT full-ranker | 0.5670 |

The paper-style BM25 parameters did not close the gap by themselves. The next step toward the paper's BERT results would be a supervised neural reranker or full-ranker experiment, not another small BM25 parameter tweak.

Additional evidence:

- `experiments/cranfield-v0/evaluation-live-baseline-k20-binary-gen014.json`
- `experiments/cranfield-v0/evaluation-live-prf-rerank-k20-binary-gen014.json`
- `experiments/cranfield-v0/evaluation-live-paper-bm25-baseline-k20-binary-gen014.json`
- `experiments/cranfield-v0/evaluation-live-paper-bm25-prf-k20-binary-gen014.json`
- `experiments/cranfield-v0/evaluation-live-prf-rerank-phrase-gen016.json`
- `experiments/cranfield-v0/evaluation-live-paper-bm25-prf-phrase-k20-binary-gen016.json`
- `docs/evaluation/timeline.md`
