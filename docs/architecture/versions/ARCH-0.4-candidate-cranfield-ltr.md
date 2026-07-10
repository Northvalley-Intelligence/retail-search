# ARCH-0.4-candidate - Cranfield Learning-To-Rank Candidate

Status: BGE-feature LTR improved offline, not released
Search Evolution: `SE-0004`
Mission: `M-0001`
Decision: `ADL-0004`
Git tag: not assigned

## Scope

`ARCH-0.4-candidate` adds an offline learning-to-rank evaluation path for Cranfield. It does not change the public API default and does not replace the current refined `prf-rerank` candidate.

The candidate path is:

1. read cached field-sum top-50 candidate pools
2. extract supervised ranking features for each query-result pair
3. optionally add cached vector similarity features from Ollama or BGE embeddings
4. train lightweight coordinate-ascent LTR models with query-grouped folds
5. compare cross-validated metrics against refined PRF
6. promote only if cross-validated and then remotely validated results beat refined PRF

## Components Added

- LTR helpers in `src/evaluation/ltr.js`
- LTR evaluator in `scripts/evaluate-cranfield-ltr.mjs`
- Coordinate-ascent LTR and pointwise boosted-tree LTR model options
- Package script:
  - `npm run eval:cranfield:ltr`
- Tests in `test/ltr.test.js`

## Current Evidence

GEN-020 evaluated coordinate-ascent LTR with and without cached Ollama `llama3.1:8b` embedding features. GEN-021 evaluated pointwise boosted-tree LTR. GEN-022 evaluated BGE `BAAI/bge-base-en-v1.5` vector features.

Best graded result:

| Metric | Field-sum cache | Boosted-tree CV | Refined PRF best | Coordinate LTR + BGE CV | Boosted-tree LTR + BGE CV |
| --- | ---: | ---: | ---: | ---: | ---: |
| nDCG@10 | 0.3022 | 0.3216 | 0.3260 | 0.3541 | 0.3603 |
| MAP | 0.2452 | 0.2631 | 0.2699 | 0.3025 | 0.3026 |
| Precision@10 | 0.2418 | 0.2564 | 0.2680 | 0.2822 | 0.2831 |
| Recall@10 | 0.4136 | 0.4346 | 0.4469 | 0.4773 | 0.4804 |
| MRR | 0.5499 | 0.5434 | 0.5622 | 0.5901 | 0.5935 |

Paper-comparable result:

| Metric | Field-sum cache | Boosted-tree CV | Refined PRF best | Coordinate LTR + BGE CV | Boosted-tree LTR + BGE CV |
| --- | ---: | ---: | ---: | ---: | ---: |
| nDCG@20 | 0.4319 | 0.4457 | 0.4563 | 0.4857 | 0.4910 |

Candidate-pool oracle:

| Metric | Value |
| --- | ---: |
| Top-50 relevant-document pool recall | 0.6042 |
| Query coverage | 0.9644 |
| Oracle nDCG@10 | 0.7033 |
| Oracle binary nDCG@20 | 0.7482 |

## Status

BGE-feature LTR has useful supervised signal and beats refined PRF offline. The simpler BGE hybrid path is slightly stronger on binary nDCG@20, has now been validated in remote OpenSearch, and is easier to deploy. `ARCH-0.4-candidate` remains unreleased until transferability or stronger ranking evidence justifies LTR complexity.

Promotion requires:

- cross-validated metrics above refined PRF, already satisfied offline by BGE features
- evidence that LTR complexity beats or meaningfully complements the simpler remote BGE hybrid path
- traceable comparison artifact
- no public-default switch before transferability evidence
