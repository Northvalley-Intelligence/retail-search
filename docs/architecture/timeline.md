# Architecture Timeline

| Version | Search Evolution | Mission | Components Added | Components Removed | Components Modified | Scope | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ARCH-0.1` | `SE-0001` | `M-0001` | OpenSearch BM25 index, Cloudflare Worker API, search/explain/evaluation surfaces | None | None | Cranfield baseline | Live and validated |
| `ARCH-0.2-candidate` | `SE-0002` | `M-0001` | Failure behavior grouping, field-sum query candidate, coverage rerank candidate, PRF rerank candidate, phrase coherence rerank, relevance modes, paper-BM25 index profile, evaluation comparison script, cached retrieval-pool fast loop | None | Query construction, candidate reranking, index profile option, evaluation output, and reranker tuning workflow | Cranfield candidate only | PRF rerank plus phrase coherence is best local Cranfield candidate; cached tuning loop and paper-BM25 comparison recorded; transferability pending |
| `ARCH-0.3-candidate` | `SE-0003` | `M-0001` | Embedding cache script, local Ollama provider path, Hugging Face provider path, vector retrieval helper, offline vector/hybrid evaluator, remote OpenSearch BGE loader, remote OpenSearch vector/hybrid evaluator | None | Evaluation workflow and separate candidate vector index | Cranfield candidate evidence | BGE hybrid beats refined PRF offline and in remote OpenSearch; transferability and promotion policy pending |
| `ARCH-0.4-candidate` | `SE-0004` | `M-0001` | Offline LTR feature extraction, coordinate-ascent training, boosted-tree LTR, BGE feature support, query-fold evaluation, LTR evaluator script | None | Evaluation workflow only | Cranfield candidate offline evidence | BGE-feature LTR beats refined PRF offline; simpler BGE hybrid remains preferred for remote validation until complexity is justified |

## Versions

- [ARCH-0.1 - Cranfield OpenSearch Baseline](versions/ARCH-0.1-cranfield-baseline.md)
- [ARCH-0.2-candidate - Cranfield PRF Rerank Candidate](versions/ARCH-0.2-candidate-cranfield-field-sum.md)
- [ARCH-0.3-candidate - Cranfield Vector Hybrid Candidate](versions/ARCH-0.3-candidate-cranfield-vector-hybrid.md)
- [ARCH-0.4-candidate - Cranfield Learning-To-Rank Candidate](versions/ARCH-0.4-candidate-cranfield-ltr.md)
