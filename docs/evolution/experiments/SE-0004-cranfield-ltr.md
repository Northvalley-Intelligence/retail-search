# SE-0004 - Cranfield Learning-To-Rank

Status: BGE-feature LTR beats refined PRF offline; simpler remote BGE hybrid is currently preferred
Mission: `M-0001`
Phase: Phase 1 - Cranfield Foundation
Dataset: Cranfield
Baseline architecture: `ARCH-0.1`
Prior best candidate: `ARCH-0.2-candidate`
Candidate architecture: `ARCH-0.4-candidate`
Decision: `ADL-0004`
Related article: `A-0002`
Git tag: not assigned

## Question

The current evidence says many relevant documents are in the cached top-50 field-sum candidate pool but are not ranked high enough. `SE-0004` tests whether supervised learning-to-rank can reorder that pool better than refined `prf-rerank`.

## Implementation

GEN-020 adds:

- `src/evaluation/ltr.js`
- `scripts/evaluate-cranfield-ltr.mjs`
- `npm run eval:cranfield:ltr`
- `test/ltr.test.js`

The evaluator uses query-grouped 5-fold cross-validation for promotion decisions and records in-sample results separately as capacity evidence.

Features include lexical score/rank, query coverage, phrase coverage, PRF feedback coverage, PRF-style score, optional vector similarity, vector rank, and document length features.

GEN-021 extends this path with dependency-free pointwise boosted-tree LTR.

GEN-022 adds BGE `BAAI/bge-base-en-v1.5` retrieval embeddings as vector similarity features.

## Evidence

Artifacts:

- `experiments/cranfield-v0/evaluation-ltr-ollama-features-gen020.json`
- `experiments/cranfield-v0/evaluation-ltr-ollama-features-k20-binary-gen020.json`
- `experiments/cranfield-v0/evaluation-ltr-lexical-features-gen020.json`
- `experiments/cranfield-v0/evaluation-ltr-lexical-features-k20-binary-gen020.json`
- `experiments/cranfield-v0/evaluation-ltr-boosted-trees-gen021.json`
- `experiments/cranfield-v0/evaluation-ltr-boosted-trees-k20-binary-gen021.json`
- `experiments/cranfield-v0/evaluation-ltr-boosted-trees-depth3-gen021.json`
- `experiments/cranfield-v0/evaluation-ltr-boosted-trees-depth3-k20-binary-gen021.json`
- `experiments/cranfield-v0/evaluation-ltr-huggingface-bge-base-en-v15-features-gen022.json`
- `experiments/cranfield-v0/evaluation-ltr-huggingface-bge-base-en-v15-features-k20-binary-gen022.json`
- `experiments/cranfield-v0/evaluation-ltr-boosted-trees-huggingface-bge-base-en-v15-features-gen022.json`
- `experiments/cranfield-v0/evaluation-ltr-boosted-trees-huggingface-bge-base-en-v15-features-k20-binary-gen022.json`
- `docs/evaluation/cranfield-ltr-research.md`

Candidate pool:

| Fact | Value |
| --- | ---: |
| Relevant-document pool recall | 0.6042 |
| Query coverage | 0.9644 |
| Oracle nDCG@10 | 0.7033 |
| Oracle binary nDCG@20 | 0.7482 |

Best graded nDCG@10:

| Run | nDCG@10 | Status |
| --- | ---: | --- |
| Refined `prf-rerank` best | 0.3260 | prior lexical best |
| Field-sum cache | 0.3022 | baseline |
| LTR with Ollama features, 5-fold CV | 0.3164 | below PRF |
| LTR lexical/PRF features, 5-fold CV | 0.3166 | best LTR CV, below PRF |
| LTR lexical/PRF features, in-sample | 0.3338 | capacity evidence only |
| Boosted-tree LTR, depth 3, 5-fold CV | 0.3216 | best LTR graded CV, below PRF |
| Boosted-tree LTR, depth 3, in-sample | 0.3564 | capacity evidence only |
| LTR with BGE features, 5-fold CV | 0.3541 | above PRF |
| Boosted-tree LTR with BGE features, 5-fold CV | 0.3603 | best LTR graded CV |

Best binary nDCG@20:

| Run | nDCG@20 | Status |
| --- | ---: | --- |
| Paper-style BM25 plus refined PRF | 0.4563 | prior lexical comparable best |
| Field-sum cache | 0.4319 | baseline |
| LTR with Ollama features, 5-fold CV | 0.4467 | below PRF |
| LTR lexical/PRF features, 5-fold CV | 0.4529 | best LTR CV, below PRF |
| LTR lexical/PRF features, in-sample | 0.4607 | capacity evidence only |
| Boosted-tree LTR, depth 3, 5-fold CV | 0.4457 | below lexical LTR and PRF |
| Boosted-tree LTR, depth 3, in-sample | 0.4840 | capacity evidence only |
| LTR with BGE features, 5-fold CV | 0.4857 | above PRF |
| Boosted-tree LTR with BGE features, 5-fold CV | 0.4910 | above PRF |

## Decision

Do not promote LTR based on GEN-020 or GEN-021 alone.

GEN-021 boosted trees improve graded cross-validation over the GEN-020 coordinate model, but still remain below refined PRF and regress on the binary comparison.

GEN-022 BGE features make LTR beat refined PRF offline. GEN-023 remotely validated the simpler BGE hybrid path, which is slightly better on binary nDCG@20 and operationally simpler. Keep `ARCH-0.4-candidate` as evaluated ranking infrastructure until LTR complexity is justified by transferability or stronger ranking evidence.

## Next Required Experiment

Use the BGE evidence to decide the next production-shaped candidate:

- compare simple remote BGE hybrid retrieval against BGE LTR before choosing implementation complexity
- validate transferability before promotion
- neural reranker over top-50/top-100 candidates if transferability or complexity comparison shows simple hybrid is not enough
- top-100/top-200 retrieval-pool refresh if recall becomes the limiting factor

## Rollback

No public rollback is needed. GEN-020 through GEN-022 add offline LTR evaluation tooling and artifacts only. The public default remains `ARCH-0.1`; BGE LTR is an offline candidate, and remote BGE hybrid is a separate candidate index, not a deployed default.
