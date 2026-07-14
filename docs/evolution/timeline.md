# Search Evolution Timeline

The Search Evolution Timeline is the primary engineering dashboard. It preserves accepted, rejected, deferred, superseded, and rolled-back experiments.

| ID | Mission | Phase | Dataset | Architecture | Git Tag | Article | Decision | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `SE-0001` | `M-0001` | Phase 1 | Cranfield | `ARCH-0.1` | `v0.1.0` | `A-0002` | `ADL-0001` | Live baseline validated |
| `SE-0002` | `M-0001` | Phase 1 | Cranfield | `ARCH-0.2-candidate` | not assigned | `A-0003` | `ADL-0002` | PRF rerank plus phrase coherence is best current Cranfield candidate; cached tuning loop and paper-BM25 comparison recorded; transferability pending |
| `SE-0003` | `M-0001` | Phase 1 | Cranfield | `ARCH-0.3-candidate` | not assigned | `A-0004` | `ADL-0003` | BGE vector/hybrid beats refined PRF offline and in remote OpenSearch; transferability and promotion policy pending |
| `SE-0004` | `M-0001` | Phase 1 | Cranfield | `ARCH-0.4-candidate` | not assigned | `A-0004` | `ADL-0004` | BGE-feature LTR beats refined PRF offline; compare against simpler BGE hybrid before promotion |

## Entries

- [SE-0001 - Cranfield OpenSearch BM25 Baseline](experiments/SE-0001-cranfield-baseline.md)
- [SE-0002 - Cranfield Failure Grouping And Candidate Reranking](experiments/SE-0002-cranfield-field-sum.md)
- [SE-0003 - Cranfield Vector And Hybrid Retrieval](experiments/SE-0003-cranfield-vector-hybrid.md)
- [SE-0004 - Cranfield Learning-To-Rank](experiments/SE-0004-cranfield-ltr.md)

Related metric ledger: [Evaluation Timeline](../evaluation/timeline.md)
