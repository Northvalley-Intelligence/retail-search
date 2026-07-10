# Milestone Endpoints

Milestone endpoints provide stable search and explain aliases for key Cranfield architecture states. They are comparison endpoints, not public-default promotion.

## ARCH-0.1 Baseline

- Search: `/api/milestones/arch-0.1/search?q=...`
- Explain: `/api/milestones/arch-0.1/explain?q=...`
- Architecture: `baseline`
- Status: released baseline
- Evidence: `experiments/cranfield-v0/evaluation-live.json`
- Result: graded nDCG@10 `0.2995`

These routes always use the accepted baseline even if an `architecture` query parameter is supplied.

## ARCH-0.2 Refined PRF Candidate

- Search: `/api/milestones/arch-0.2-prf/search?q=...`
- Explain: `/api/milestones/arch-0.2-prf/explain?q=...`
- Architecture: `prf-rerank`
- Status: candidate, transferability pending
- Evidence: `experiments/cranfield-v0/evaluation-live-prf-rerank-phrase-gen016.json`
- Result: graded nDCG@10 `0.3260`, binary nDCG@20 `0.4563`

These routes expose the best live lexical candidate without making it the public default.

## ARCH-0.3 BGE Vector Hybrid Candidate

- Search: `/api/milestones/arch-0.3-bge/search?q=...`
- Explain: `/api/milestones/arch-0.3-bge/explain?q=...`
- Architecture: `bge-vector-hybrid`
- Status: candidate, runtime endpoint not enabled
- Remote candidate index: `cranfield-v0-bge-base-en-v15-gen023`
- Evidence:
  - `experiments/cranfield-v0/evaluation-live-opensearch-bge-base-en-v15-gen023.json`
  - `experiments/cranfield-v0/evaluation-live-opensearch-bge-base-en-v15-k20-binary-gen023.json`
- Result: graded nDCG@10 `0.3533`, binary nDCG@20 `0.4926`

These routes currently return `501 milestone_runtime_not_enabled`. The BGE path is validated in remote OpenSearch, but arbitrary user queries require runtime query-vector generation or a bounded known-query embedding cache before this can serve live search results honestly.

## ARCH-0.3 Demo Samples

- Demo: `/api/milestones/arch-0.3-bge/demo?sample=all`
- Single sample: `/api/milestones/arch-0.3-bge/demo?sample=3`
- Samples: `1`, `3`, `9`, or `all`
- Status: archived demo only, not live runtime search
- Evidence: `experiments/cranfield-v0/evaluation-live-opensearch-bge-base-en-v15-gen023.json`
- Result: archived query-level evidence for `ARCH-0.3-candidate` without pretending arbitrary BGE queries are runtime-enabled

The demo endpoint returns archived GEN-023 sample rows from the remote OpenSearch BGE validation so the UI can show a few query-level examples.

## Aliases

- `baseline` and `v0.1` resolve to `arch-0.1`
- `prf` and `prf-rerank` resolve to `arch-0.2-prf`
- `bge` and `vector-hybrid` resolve to `arch-0.3-bge`
