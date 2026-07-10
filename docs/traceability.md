# Project Traceability And Versioning

Every meaningful Retail Search artifact receives a stable identifier and cross-links to the engineering evidence that created it.

## Identifier Standards

| Artifact | Format | Current Phase 1 ID |
| --- | --- | --- |
| Mission | `M-0001` | `M-0001` |
| Article | `A-0001` | `A-0002` |
| Search Evolution entry | `SE-0001` | `SE-0001` |
| Architecture version | `ARCH-0.1` | `ARCH-0.1` |
| Architecture decision | `ADL-0001` | `ADL-0001` |
| Evaluation artifact | experiment path plus generation id | `evaluation-live-prf-rerank-phrase-gen016.json` |
| Git tag | semantic version | `v0.1.0` |

## Current Chain

```text
Mission M-0001
  -> Article A-0002
  -> Search Evolution SE-0001
  -> Architecture ARCH-0.1
  -> Decision ADL-0001
  -> Git Tag v0.1.0
  -> /api/v0.1/search
  -> /api/v0.1/explain
```

## Canonical Artifacts

- Mission: [M-0001 Cranfield Foundation](missions/M-0001-cranfield-foundation.md)
- Article handoff: [A-0002 Baseline Before Agents](articles/A-0002-baseline-before-agents.md)
- Search Evolution timeline: [timeline](evolution/timeline.md)
- Search Evolution entry: [SE-0001 Cranfield Baseline](evolution/experiments/SE-0001-cranfield-baseline.md)
- Candidate Search Evolution entry: [SE-0002 Cranfield Candidate Reranking](evolution/experiments/SE-0002-cranfield-field-sum.md)
- Vector Search Evolution entry: [SE-0003 Cranfield Vector And Hybrid Retrieval](evolution/experiments/SE-0003-cranfield-vector-hybrid.md)
- LTR Search Evolution entry: [SE-0004 Cranfield Learning-To-Rank](evolution/experiments/SE-0004-cranfield-ltr.md)
- Evaluation timeline: [timeline](evaluation/timeline.md)
- LTR evidence: [Cranfield learning-to-rank research](evaluation/cranfield-ltr-research.md)
- Architecture timeline: [timeline](architecture/timeline.md)
- Architecture version: [ARCH-0.1 Cranfield Baseline](architecture/versions/ARCH-0.1-cranfield-baseline.md)
- Candidate architecture version: [ARCH-0.2-candidate Cranfield PRF Rerank Candidate](architecture/versions/ARCH-0.2-candidate-cranfield-field-sum.md)
- Vector candidate architecture version: [ARCH-0.3-candidate Cranfield Vector Hybrid Candidate](architecture/versions/ARCH-0.3-candidate-cranfield-vector-hybrid.md)
- LTR candidate architecture version: [ARCH-0.4-candidate Cranfield Learning-To-Rank Candidate](architecture/versions/ARCH-0.4-candidate-cranfield-ltr.md)
- Decision: [ADL-0001 Cranfield OpenSearch Baseline](architecture/decisions/ADL-0001-cranfield-opensearch-baseline.md)
- Candidate decision: [ADL-0002 Cranfield PRF Rerank Candidate](architecture/decisions/ADL-0002-cranfield-field-sum-candidate.md)
- Vector candidate decision: [ADL-0003 Cranfield Vector Hybrid Candidate](architecture/decisions/ADL-0003-cranfield-vector-hybrid-candidate.md)
- LTR candidate decision: [ADL-0004 Cranfield Learning-To-Rank Candidate](architecture/decisions/ADL-0004-cranfield-ltr-candidate.md)
- Endpoints: [ARCH-0.1 endpoints](endpoints/ARCH-0.1-endpoints.md)
- Milestone endpoints: [milestone endpoints](endpoints/milestone-endpoints.md)
- Failure grouping evidence: [Cranfield failure behavior groups](evaluation/cranfield-failure-groups.md)
- PRF and paper comparison evidence: [Cranfield PRF rerank research](evaluation/cranfield-prf-rerank-research.md)
- Vector and hybrid evidence: [Cranfield vector and hybrid research](evaluation/cranfield-vector-hybrid-research.md)

## Current Gaps

- `v0.1.0` exists and points to commit `baeae54`.
- The public Worker supports `/api/v0.1/search` and `/api/v0.1/explain`; deployment was verified on Worker version `3e9597b9-f791-457f-805f-f1dbb8123a3c`.
- The public Worker supports milestone comparison endpoints for `ARCH-0.1`, `ARCH-0.2-candidate`, and `ARCH-0.3-candidate`: `/api/milestones/arch-0.1/search`, `/api/milestones/arch-0.2-prf/search`, and `/api/milestones/arch-0.3-bge/search`, plus matching `/explain` routes. The `ARCH-0.3-bge` route intentionally returns `501 milestone_runtime_not_enabled` until runtime query-vector support exists.
- `ARCH-0.2-candidate` is not a released architecture version; it needs Phase 2 transferability evidence before promotion.
- Candidate improvements after `v0.1.0` are intentionally untagged until an accepted `ARCH-0.2` release is approved.

## Candidate Trace Rule

Every metric-moving candidate must update:

1. mission update entry
2. evaluation timeline row
3. search evolution row and entry
4. architecture timeline row and candidate version
5. architecture decision ledger
6. `.mde/traceability.json`
7. generation summary
8. experiment README artifact list

For reranker-only experiments, the preferred evidence path is:

1. cache first-stage retrieval pools from remote OpenSearch
2. tune locally from the cache
3. remotely validate only winning candidates

GEN-017 establishes that fast loop with `retrieval-pools-field-sum-top50-gen017.json` and `prf-phrase-tuning-from-cache-gen017.json`.

For embedding experiments, local deterministic providers are control evidence only. GEN-019 adds a real local Ollama embedding artifact and comparison, but it remains below refined PRF. A vector/hybrid candidate can be considered for promotion only after an embedding or neural-reranker artifact is linked to the evaluation timeline and beats the refined PRF thresholds.

For supervised LTR experiments, query-grouped cross-validation is required for promotion decisions. In-sample LTR results may be recorded as ranking-capacity evidence, but they cannot promote an architecture without held-out or transferability evidence.
