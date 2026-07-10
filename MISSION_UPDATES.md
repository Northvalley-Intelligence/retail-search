# Mission Updates

## 2026-07-04 - Generation 0 Bootstrap

- Created project from Control Center input.
- Captured mission and initialized project-local MDE artifacts.

## 2026-07-04 - GEN-001 Phase 1 Cranfield Foundation

- Created public GitHub repository: https://github.com/Northvalley-Intelligence/retail-search
- Implemented Cloudflare Worker-compatible Cranfield search and explain endpoints backed by generated OpenSearch requests.
- Added OpenSearch index mapping, sample indexing artifact, baseline evaluator, architecture decision record, and local validation workflow.
- Public Phase 1 acceptance remains blocked on live OpenSearch corpus setup and Cloudflare Worker deployment.

## 2026-07-04 - GEN-002 Phase 1 Deployment Unblockers

- Added a non-deploying full Cranfield export path from the public Glasgow collection used by `ir_datasets` dataset id `cranfield`.
- Verified the exporter against the public source in `/private/tmp`: 1,400 documents, 225 queries, and 1,837 qrels.
- Documented the recommended AWS OpenSearch Service managed-cluster setup, runtime/indexer credential split, Cloudflare variable/secret requirements, and free-tier caveats.
- Verified Cloudflare token/account/Workers read access without printing secrets or deploying.
- Public Phase 1 acceptance remains blocked on creation of a live OpenSearch domain, OpenSearch users/passwords, corpus loading, and explicit deployment approval.

## 2026-07-04 - GEN-003 Live OpenSearch Cranfield Load

- Translated the provided OpenSearch `ServiceURL` from `/tmp/opensearch.md` into ignored local `.env.local` keys without printing secret values.
- Verified live OpenSearch health: OpenSearch 3.3.2, green cluster, one node.
- Created `cranfield-v0`, exported the public Cranfield corpus, bulk-loaded 1,400 documents, and verified live count 1,400.
- Ran live Cranfield evaluation over 225 queries: MAP 0.2402, nDCG@10 0.2995, Precision@10 0.2316, Recall@10 0.3994, MRR 0.535.
- Public Phase 1 acceptance remains blocked on Cloudflare Worker secret configuration, deployment approval, and public endpoint verification.

## 2026-07-05 - GEN-004 Public Cloudflare Deployment

- Uploaded `OPENSEARCH_URL`, `OPENSEARCH_USERNAME`, and `OPENSEARCH_PASSWORD` as Cloudflare Worker secrets without printing values.
- Deployed the `retail-search` Cloudflare Worker to `https://retail-search.feroshjacob.workers.dev`.
- Verified public `/health`, `/api/cranfield/search`, `/api/cranfield/explain`, `/api/search`, and `/api/explain` endpoints against the live `cranfield-v0` index.
- Re-ran local validation and public endpoint checks as the second validation pass.
- Phase 1 public Cranfield baseline is now deployed and validated; broader latency sampling remains a follow-up measurement.

## 2026-07-05 - GEN-005 Public Search Interface

- Added a public root search interface at `https://retail-search.feroshjacob.workers.dev`.
- Added indexed-data guidance for the Cranfield corpus: document count, evaluation query count, qrel count, searchable fields, topic hints, and example queries.
- Added `/api/cranfield/meta`, `/api/datasets/cranfield`, and `/api/dataset` metadata endpoints.
- Verified the interface, metadata, search, and explain endpoints through two public validation passes.

## 2026-07-05 - GEN-006 Search Explain Flow Diagram

- Added a six-step retrieval flow to the explain response: Query, Normalize, OpenSearch Query, Retrieve, Rank, Explain.
- Rendered that flow as a diagram in the public Search Explain panel.
- Deployed Worker version `f30691e0-1fe2-4a04-917c-0537697d0a3d`.
- Verified the public root page and explain endpoints twice against live Cranfield queries.

## 2026-07-05 - GEN-007 Public Evaluation Results

- Added public evaluation results to the Phase 1 page: MAP, nDCG@10, Precision@10, Recall@10, and MRR from the live OpenSearch Cranfield run.
- Added representative strong, mixed, and weak query examples with correct results, wrong/weak results, and missed relevant document ids.
- Added `/api/cranfield/evaluation` and `/api/evaluation` JSON endpoints.
- Deployed Worker version `b81ae2c6-00fe-479d-a1ca-d9cc723f96c1` and verified the evaluation UI and endpoints twice.

## 2026-07-05 - GEN-008 Public Page Organization

- Replaced the crowded root experience with a home page that lists the project phases.
- Split Phase 1 into focused pages for overview, search, indexed data, explain flow, and evaluation examples.
- Added planned phase pages for BEIR transferability, retail relevance, and behavioral ranking so future phases have clear entry points.
- Deployed Worker version `61b9978e-788b-42f1-baa3-03c479a1c65c` and verified the organized routes, aliases, and APIs against the public Worker.

## 2026-07-05 - GEN-009 Public Dataset References

- Added official dataset references for Glasgow Cranfield, BEIR, and Amazon ESCI to the public phase pages.
- Marked the future behavior data source as not selected yet instead of implying a dataset exists.
- Added Cranfield source URLs to `/api/cranfield/meta`.
- Deployed Worker version `68e53192-0cad-4466-b238-f2ab35150d1f` and verified the reference links plus live search behavior against the public Worker.

## 2026-07-06 - GEN-010 Traceability And Versioning

- Added the project traceability and versioning standard to `MISSION.md`.
- Added the current Phase 1 traceability chain: `M-0001` -> `A-0002` -> `SE-0001` -> `ARCH-0.1` -> `ADL-0001` -> `v0.1.0`.
- Added traceability docs, timelines, canonical architecture decision record, endpoint manifest, and `.mde/traceability.json`.
- Added local `/api/v0.1/search` and `/api/v0.1/explain` aliases plus traceability payloads in local API responses.
- Added `scripts/validate-traceability.mjs` to `npm run validate`.
- Local validation passed; deployment of `/api/v0.1/*` and creation of git tag `v0.1.0` remain pending explicit approval.

## 2026-07-07 - GEN-011 Cranfield Failure Behavior Grouping

- Added live Cranfield failure behavior grouping so aggregate metrics can be traced to query-level behaviors such as zero relevant top-10 results, late first relevant rank, lexical noise, broad low-recall needs, graded ranking loss, and partial recall.
- Added opt-in architecture candidates for `query-rescue` and `field-sum`; the accepted public default remains the `ARCH-0.1` baseline.
- Live query-rescue evaluation regressed all core metrics and is retained as rejected evidence.
- Live field-sum evaluation improved all core metrics over baseline: MAP 0.2402 -> 0.2452, nDCG@10 0.2995 -> 0.3022, Precision@10 0.2316 -> 0.2418, Recall@10 0.3994 -> 0.4136, MRR 0.5350 -> 0.5499.
- Added `SE-0002`, `ARCH-0.2-candidate`, and `ADL-0002` documentation plus comparison artifacts under `experiments/cranfield-v0/`.
- Field-sum is not promoted to a released architecture until Phase 2 BEIR transferability evidence is available.

## 2026-07-07 - GEN-012 Coverage Rerank Candidate

- Drilled into the 28 baseline `zero_relevant_at_k` queries: 19 had a judged relevant result between ranks 11 and 50, while 9 had no judged relevant result in the top 50.
- Added opt-in `coverage-rerank`, which retrieves top 50 with field-sum and applies a small deterministic title/abstract query-term coverage bonus before returning results.
- Live coverage-rerank evaluation improved all core metrics over baseline and field-sum: MAP 0.2531, nDCG@10 0.3095, Precision@10 0.2502, Recall@10 0.4283, MRR 0.5520.
- Zero-relevant top-10 cases improved only slightly, 28 -> 27, so the remaining unresolved group is likely true recall/vocabulary mismatch.
- Public default remains `ARCH-0.1`; coverage-rerank remains transferability-pending.

## 2026-07-07 - GEN-013 PRF Rerank Candidate

- Researched reproducible Cranfield and IR reranking patterns and did not find a reliable primary-source public leaderboard for highest Cranfield nDCG@10.
- Added opt-in `prf-rerank`, which retrieves top 50 with field-sum, treats the top 4 hits as pseudo-relevant feedback, extracts 8 feedback terms, and reranks with normalized OpenSearch score plus original-query and feedback-term coverage.
- Live PRF rerank evaluation improved all core metrics over baseline and coverage-rerank: MAP 0.2696, nDCG@10 0.3253, Precision@10 0.2676, Recall@10 0.4466, MRR 0.5620.
- PRF rerank became the best current Cranfield `ARCH-0.2-candidate`, but the public default remains `ARCH-0.1` until Phase 2 transferability evidence exists.

## 2026-07-07 - GEN-014 Paper-BM25 Comparability Check

- Added binary relevance mode and a paper-style OpenSearch BM25 index profile using BM25 `k1=1.5` and `b=0.75` to compare against the Cranfield BERT paper's NDCG@20 table.
- Loaded a separate `cranfield-v0-paper-bm25` index without changing the public/default `cranfield-v0` index.
- Comparable binary NDCG@20 results: default baseline 0.4187, default PRF rerank 0.4542, paper-style BM25 baseline 0.4196, paper-style BM25 plus PRF rerank 0.4547.
- The external paper reports BM25 0.4714, BERT re-ranker 0.5525, and BERT full-ranker 0.5670 on NDCG@20; this project is closer after PRF rerank but still below the paper BM25 and BERT results.
- No Git tag was assigned because this remains a candidate experiment, not a released architecture.

## 2026-07-07 - GEN-015 Evolution Traceability Repair

- Added an explicit evaluation timeline so metric artifacts are linked to mission, generation, search evolution, architecture, decision, tag status, and release status.
- Updated the architecture timeline, search evolution timeline, traceability registry, experiment README, and candidate architecture docs so `prf-rerank` and paper-BM25 comparison are represented consistently.
- Standardized candidate tag semantics: released architectures receive Git tags; candidate-only experiments keep `Git tag: not assigned` until promotion.
- Next experiments must update the mission update, evaluation timeline, search evolution entry, architecture timeline/version, decision ledger, and traceability registry in the same generation.

## 2026-07-07 - GEN-016 PRF Phrase Coherence Refinement

- Tested the next optimization after PRF rerank: a second PRF-expanded retrieval pass. It regressed core metrics, with nDCG@10 0.3219 versus PRF rerank 0.3253, so it is retained as rejected evidence.
- Added a local PRF tuning script and tested phrase-coherence weights on top of the existing PRF rerank settings.
- Added a small adjacent-query-phrase coherence bonus at weight 0.01 to `prf-rerank`.
- Live refined PRF evaluation improved all core metrics over the prior PRF candidate: MAP 0.2696 -> 0.2699, nDCG@10 0.3253 -> 0.3260, Precision@10 0.2676 -> 0.2680, Recall@10 0.4466 -> 0.4469, MRR 0.5620 -> 0.5622.
- Paper-style BM25 plus refined PRF improved binary NDCG@20 0.4547 -> 0.4563.
- Public default remains `ARCH-0.1`; refined PRF remains `ARCH-0.2-candidate` and is not tagged or promoted until transferability evidence exists.

## 2026-07-07 - GEN-017 Cached Retrieval Pool Fast Loop

- Added `npm run cache:cranfield` to create reusable live OpenSearch retrieval-pool artifacts for first-stage candidates.
- Generated `experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json` with 225 Cranfield queries and field-sum top-50 results.
- Updated `npm run tune:cranfield:prf` so reranker tuning can read `--retrieval-cache` and run offline without repeated remote OpenSearch calls.
- Verified the cached workflow by reproducing the refined PRF phrase tuning result from cache: nDCG@10 0.3260 with phrase weight 0.01.
- Future reranker experiments should use cached retrieval pools for tuning, then run remote OpenSearch only for cache refreshes, index-level candidates, and final validation of winners.

## 2026-07-07 - GEN-018 Vector Hybrid Embedding Candidate

- Added `npm run embed:cranfield` and `npm run eval:cranfield:vector` for offline vector-only and hybrid retrieval experiments.
- Implemented a real embedding-provider path with `--provider openai`, plus deterministic `local-hash` vectors for local control runs.
- No `OPENAI_API_KEY` was configured, so real LLM embeddings were not generated in this run.
- Local vector-control results did not beat refined PRF: vector-only nDCG@10 0.1453; best local-hash hybrid nDCG@10 0.3054 versus refined PRF nDCG@10 0.3260.
- Paper-comparable local-hash hybrid reached binary nDCG@20 0.4340, below refined PRF's 0.4563.
- Added `SE-0003`, `ARCH-0.3-candidate`, and `ADL-0003`; vector/hybrid remains infrastructure-ready but not promoted.

## 2026-07-08 - GEN-019 Local Ollama Embeddings

- Extended `npm run embed:cranfield` with `--provider ollama`, `--host`, `--checkpoint-dir`, `--text-profile`, and `--progress` so the local Ollama instance behind `/Users/feroshjacob/codefj/local_llm` can generate restartable Cranfield embeddings without changing that project.
- Generated real local embeddings with Ollama `llama3.1:8b` over the Cranfield title+abstract profile: 1,400 documents, 225 queries, 4,096 dimensions.
- Evaluated vector-only and hybrid retrieval against the cached field-sum pools from GEN-017.
- Local Ollama vector-only was weak: nDCG@10 0.0282.
- Best local Ollama hybrid slightly improved the field-sum cache, but did not beat refined PRF: nDCG@10 0.3035 versus refined PRF 0.3260.
- Paper-comparable local Ollama hybrid reached binary nDCG@20 0.4343, below refined PRF's 0.4563.
- `ARCH-0.3-candidate` remains not promoted; next valid vector attempt should use a dedicated embedding model or neural reranker rather than chat-model embeddings.

## 2026-07-08 - GEN-020 Learning-To-Rank Candidate

- Added `npm run eval:cranfield:ltr` with offline LTR feature extraction, coordinate-ascent training, query-grouped 5-fold cross-validation, candidate-pool oracle metrics, and in-sample capacity reporting.
- Reused the cached field-sum top-50 retrieval pools and cached Ollama `llama3.1:8b` embeddings; no embedding regeneration was needed.
- Candidate-pool evidence shows this is substantially a ranking problem: top-50 query coverage is 0.9644 and oracle nDCG@10 is 0.7033, though relevant-document pool recall is only 0.6042.
- Cross-validated LTR improved field-sum but did not beat refined PRF: best graded nDCG@10 was 0.3166 versus refined PRF 0.3260.
- Paper-comparable binary LTR got closer but still did not beat refined PRF: best cross-validated nDCG@20 was 0.4529 versus refined PRF 0.4563.
- In-sample LTR exceeded refined PRF, with graded nDCG@10 0.3338 and binary nDCG@20 0.4607, but this is treated as capacity evidence only because it can overfit Cranfield.
- Ollama embeddings did not help the LTR ablation; lexical/PRF-style features were better under cross-validation.
- Added `SE-0004`, `ARCH-0.4-candidate`, and `ADL-0004`; LTR remains evaluated infrastructure but is not promoted.

## 2026-07-08 - GEN-021 Boosted-Tree LTR

- Extended the LTR evaluator with dependency-free pointwise gradient-boosted regression trees.
- Ran boosted-tree LTR over the cached field-sum top-50 pools without regenerating retrieval pools or embeddings.
- Best boosted-tree graded cross-validation improved over coordinate LTR but still did not beat refined PRF: nDCG@10 0.3216 versus refined PRF 0.3260.
- Boosted-tree binary cross-validation regressed versus the prior lexical LTR ablation: nDCG@20 0.4457 versus lexical LTR 0.4529 and refined PRF 0.4563.
- In-sample boosted trees were much higher, with nDCG@10 0.3564 and binary nDCG@20 0.4840, confirming ranking capacity but also overfit risk.
- `ARCH-0.4-candidate` remains not promoted; next serious step should be neural reranking or stronger external/dedicated embedding features, not more pointwise boosted-tree tuning.

## 2026-07-08 - GEN-022 Hugging Face BGE Embeddings

- Extended `npm run embed:cranfield` with `--provider huggingface`, backed by a local SentenceTransformers bridge and restartable checkpoints.
- Installed the Hugging Face stack in a temporary `/private/tmp` virtualenv and generated BGE `BAAI/bge-base-en-v1.5` embeddings for 1,400 Cranfield documents and 225 queries using title+abstract document text and a retrieval query prefix.
- Evaluated dense vector-only retrieval, field-sum plus dense hybrid retrieval, and LTR with BGE similarity features against the cached field-sum top-50 pools.
- BGE is the first embedding path to beat refined PRF offline: best hybrid graded nDCG@10 reached 0.3533 versus refined PRF 0.3260, and best hybrid binary nDCG@20 reached 0.4915 versus refined PRF 0.4563.
- BGE LTR features also beat refined PRF under query-grouped cross-validation: coordinate-ascent reached nDCG@10 0.3541 and boosted-tree LTR reached nDCG@10 0.3603.
- `ARCH-0.3-candidate` now has strong offline evidence, but it is not promoted to the public/default architecture until a remote OpenSearch vector/hybrid index is validated and transferability policy is addressed.

## 2026-07-08 - GEN-023 Remote OpenSearch BGE Vector Validation

- Added a remote OpenSearch BGE candidate loader and evaluator: `npm run load:cranfield:bge` and `npm run eval:cranfield:opensearch-vector`.
- Created separate candidate index `cranfield-v0-bge-base-en-v15-gen023` with 1,400 Cranfield documents and a 768-dimensional `bge_embedding` kNN vector field; the public/default `cranfield-v0` index was not changed.
- Ran live OpenSearch vector-only, field-sum, and hybrid evaluations over all 225 Cranfield queries using cached BGE query embeddings.
- Remote BGE hybrid reproduced the offline graded gain: best graded nDCG@10 is 0.3533 versus refined PRF 0.3260.
- Remote BGE hybrid slightly improved the offline binary result: best binary nDCG@20 is 0.4926 versus refined PRF 0.4563 and offline BGE hybrid 0.4915.
- `ARCH-0.3-candidate` is now the best production-shaped Cranfield candidate, but it remains candidate-only and untagged until transferability and public/default promotion policy are addressed.

## 2026-07-08 - GEN-024 Milestone Search And Explain Endpoints

- Added stable milestone endpoint aliases for the key Cranfield architecture states:
  - `/api/milestones/arch-0.1/search` and `/api/milestones/arch-0.1/explain`
  - `/api/milestones/arch-0.2-prf/search` and `/api/milestones/arch-0.2-prf/explain`
  - `/api/milestones/arch-0.3-bge/search` and `/api/milestones/arch-0.3-bge/explain`
- `ARCH-0.1` milestone routes force the accepted baseline architecture; `ARCH-0.2-prf` milestone routes force the refined PRF candidate architecture.
- `ARCH-0.3-bge` milestone routes return explicit `501 milestone_runtime_not_enabled` responses because arbitrary BGE live queries still need runtime query-vector generation or a bounded known-query embedding cache.
- Added `docs/endpoints/milestone-endpoints.md`, README examples, Worker route tests, and traceability validation for the new milestone endpoint contract.
- Public/default `/api/search` and `/api/explain` remain unchanged.

## 2026-07-09 - GEN-025 Public Milestone Endpoint Deployment

- Deployed the GEN-024 route bundle to Cloudflare Worker version `3e9597b9-f791-457f-805f-f1dbb8123a3c`.
- Verified public `/health`, `/api/v0.1/search`, `/api/milestones/arch-0.1/search`, `/api/milestones/arch-0.2-prf/explain`, and `/api/milestones/arch-0.3-bge/search`.
- Confirmed public `ARCH-0.1` and `ARCH-0.2-prf` milestone endpoints return live Cranfield responses, while public `ARCH-0.3-bge` returns the intended `501 milestone_runtime_not_enabled`.
- Public/default `/api/search` and `/api/explain` remain unchanged on the accepted `ARCH-0.1` baseline.
