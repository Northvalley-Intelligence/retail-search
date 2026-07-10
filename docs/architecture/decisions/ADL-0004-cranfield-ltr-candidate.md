# ADL-0004 - Keep BGE-Feature LTR As Offline Candidate

Status: BGE-feature LTR improved offline, simpler remote BGE hybrid currently preferred
Mission: `M-0001`
Search Evolution: `SE-0004`
Architecture version: `ARCH-0.4-candidate`
Dataset: Cranfield
Related article: `A-0002`
Related artifacts:

- `docs/evaluation/cranfield-ltr-research.md`
- `experiments/cranfield-v0/evaluation-ltr-ollama-features-gen020.json`
- `experiments/cranfield-v0/evaluation-ltr-ollama-features-k20-binary-gen020.json`
- `experiments/cranfield-v0/evaluation-ltr-lexical-features-gen020.json`
- `experiments/cranfield-v0/evaluation-ltr-lexical-features-k20-binary-gen020.json`
- `experiments/cranfield-v0/evaluation-ltr-boosted-trees-depth3-gen021.json`
- `experiments/cranfield-v0/evaluation-ltr-boosted-trees-depth3-k20-binary-gen021.json`
- `experiments/cranfield-v0/evaluation-ltr-huggingface-bge-base-en-v15-features-gen022.json`
- `experiments/cranfield-v0/evaluation-ltr-huggingface-bge-base-en-v15-features-k20-binary-gen022.json`
- `experiments/cranfield-v0/evaluation-ltr-boosted-trees-huggingface-bge-base-en-v15-features-gen022.json`
- `experiments/cranfield-v0/evaluation-ltr-boosted-trees-huggingface-bge-base-en-v15-features-k20-binary-gen022.json`

## Problem

The prior failure analysis showed a ranking problem: many relevant documents are present in the candidate pool but not high enough. The operator asked whether LTR should be tried before neural reranking, using local embedding similarities as possible features.

## Evidence

GEN-020 added an offline LTR evaluator with query-grouped 5-fold cross-validation. GEN-021 added pointwise boosted-tree LTR over the same feature rows. GEN-022 added BGE `BAAI/bge-base-en-v1.5` embedding features.

Candidate-pool evidence:

| Fact | Value |
| --- | ---: |
| Relevant-document pool recall | 0.6042 |
| Query coverage | 0.9644 |
| Oracle nDCG@10 | 0.7033 |
| Oracle binary nDCG@20 | 0.7482 |

The graded cross-validated result now beats refined PRF when BGE features are present:

| Run | nDCG@10 | Status |
| --- | ---: | --- |
| Refined PRF best | 0.3260 | prior lexical best |
| Field-sum cache | 0.3022 | baseline |
| LTR with Ollama features, 5-fold CV | 0.3164 | below PRF |
| LTR lexical/PRF features, 5-fold CV | 0.3166 | best CV, below PRF |
| LTR lexical/PRF features, in-sample | 0.3338 | capacity evidence only |
| Boosted-tree LTR, depth 3, 5-fold CV | 0.3216 | best LTR graded CV, below PRF |
| Boosted-tree LTR, depth 3, in-sample | 0.3564 | capacity evidence only |
| LTR with BGE features, 5-fold CV | 0.3541 | above PRF |
| Boosted-tree LTR with BGE features, 5-fold CV | 0.3603 | best LTR graded CV |

Paper-comparable binary nDCG@20:

| Run | nDCG@20 | Status |
| --- | ---: | --- |
| Paper-style BM25 plus refined PRF | 0.4563 | prior lexical comparable best |
| Field-sum cache | 0.4319 | baseline |
| LTR with Ollama features, 5-fold CV | 0.4467 | below PRF |
| LTR lexical/PRF features, 5-fold CV | 0.4529 | best CV, below PRF |
| LTR lexical/PRF features, in-sample | 0.4607 | capacity evidence only |
| Boosted-tree LTR, depth 3, 5-fold CV | 0.4457 | below lexical LTR and PRF |
| Boosted-tree LTR, depth 3, in-sample | 0.4840 | capacity evidence only |
| LTR with BGE features, 5-fold CV | 0.4857 | above PRF |
| Boosted-tree LTR with BGE features, 5-fold CV | 0.4910 | above PRF |

## Alternatives Considered

1. Promote in-sample LTR because it beats refined PRF.
   - Rejected because in-sample training can memorize Cranfield query behavior and is not valid promotion evidence.

2. Promote cross-validated LTR because it improves field-sum.
   - Rejected because the project promotes against the current best candidate, not against an older baseline.

3. Use local Ollama embeddings as LTR features.
   - Tested. They did not improve the cross-validated ablation and hurt the binary result.

4. Move immediately to neural reranking.
   - Deferred until LTR evidence was recorded. Neural reranking remains a reasonable next escalation.

5. Use pointwise boosted-tree LTR.
   - Tested in GEN-021. It improved graded cross-validation but still stayed below refined PRF and regressed in binary cross-validation.

6. Use BGE retrieval embeddings as LTR features.
   - Tested in GEN-022. It improved graded cross-validation to `0.3541` with coordinate ascent and `0.3603` with boosted trees; binary boosted-tree LTR reached `0.4910`.

## Decision

Keep `ARCH-0.4-candidate` as evaluated LTR infrastructure, but do not promote it yet.

BGE features satisfy the offline cross-validation bar, but the simpler BGE vector/hybrid path is slightly better on binary nDCG@20 and has now been validated in remote OpenSearch. The next valid decision point is transferability evidence and a comparison against BGE LTR complexity before promotion.

## Validation History

- `node --test test/ltr.test.js`: passed.
- `npm run eval:cranfield:ltr` with Ollama features: passed for graded nDCG@10 and binary nDCG@20.
- `npm run eval:cranfield:ltr` lexical/PRF feature ablation: passed for graded nDCG@10 and binary nDCG@20.
- `npm run eval:cranfield:ltr -- --model boosted-trees`: passed for graded nDCG@10 and binary nDCG@20.
- `npm run validate`: passed in `VAL-031` with 41 node tests and traceability checks through `GEN-021`.
- `npm run eval:cranfield:ltr` with BGE features: passed for graded nDCG@10 and binary nDCG@20.
- `npm run eval:cranfield:ltr -- --model boosted-trees` with BGE features: passed for graded nDCG@10 and binary nDCG@20.
- `npm run validate`: passed in `VAL-032` with traceability checks through `GEN-022`.
- GEN-023 remotely validated the simpler BGE hybrid comparator with nDCG@10 0.3533 and binary nDCG@20 0.4926.

## Scope

Project-local Cranfield experiment only. No remote OpenSearch LTR plugin, vector index, or Cloudflare deployment was created in GEN-022.
