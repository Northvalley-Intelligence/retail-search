# Generation Summary

## GEN-000 - Bootstrap

- Date: 2026-07-04
- Status: complete
- Focus: project creation from name and mission
- Validation: primary gate pass

## GEN-001 - Phase 1 Cranfield Foundation

- Date: 2026-07-04
- Status: local foundation complete; public deployment blocked
- Focus: OpenSearch-backed Cranfield Worker endpoints, explainability, evaluation metrics, index artifacts, repository publication
- Validation: local gate passed twice
- External blockers: live OpenSearch Cranfield corpus, Cloudflare Worker deployment, public endpoint URLs

## GEN-002 - Phase 1 Deployment Unblockers

- Date: 2026-07-04
- Status: local unblockers complete; public deployment still blocked
- Focus: full public Cranfield export, provider setup documentation, redacted Cloudflare verification
- Validation: local gate passed; public Cranfield export verified against 1,400 documents, 225 queries, and 1,837 qrels
- External blockers: live OpenSearch domain/users/passwords, live corpus loading, explicit deployment approval, public endpoint URLs

## GEN-003 - Live OpenSearch Cranfield Load

- Date: 2026-07-04
- Status: live OpenSearch foundation complete; public deployment blocked
- Focus: provider-neutral OpenSearch config, ignored local credentials, live health check, cranfield-v0 index load, live evaluation
- Validation: live OpenSearch health succeeded; cranfield-v0 created and loaded with 1,400 documents; live evaluation ran over 225 queries; local validation passed
- External blockers: Cloudflare Worker secrets, deployment approval, public endpoint URLs

## GEN-004 - Public Cloudflare Deployment

- Date: 2026-07-05
- Status: Phase 1 public Cranfield baseline deployed and validated
- Focus: Cloudflare Worker secret configuration, deployment, public health/search/explain verification, and second validation pass
- Validation: Wrangler deployment succeeded; public endpoints returned live cranfield-v0 results; local validation and public endpoint checks passed again
- External blockers: none for Phase 1 public baseline

## GEN-005 - Public Search Interface

- Date: 2026-07-05
- Status: public search interface deployed and validated
- Focus: first-screen search UI, indexed-data context, example queries, metadata endpoints, and public verification
- Validation: local validation passed with 16 tests; public root UI, metadata, search, and explain checks passed twice after VALSTRAT-004 stabilized
- External blockers: none

## GEN-006 - Search Explain Flow Diagram

- Date: 2026-07-05
- Status: explain flow diagram deployed and validated
- Focus: retrievalFlow API contract and public Search Explain flow diagram
- Validation: local validation passed with 16 tests; public root flow UI and explain retrievalFlow checks passed twice
- External blockers: none

## GEN-007 - Public Evaluation Results

- Date: 2026-07-05
- Status: evaluation results deployed and validated
- Focus: aggregate metrics, correct/wrong/missed examples, and evaluation JSON endpoints
- Validation: local validation passed with 17 tests; public evaluation UI and `/api/cranfield/evaluation` plus `/api/evaluation` checks passed twice
- External blockers: none

## GEN-008 - Public Page Organization

- Date: 2026-07-05
- Status: organized public pages deployed and validated
- Focus: home page phase directory plus focused Phase 1 overview, search, data, explain, and evaluation pages
- Validation: local validation passed with 20 tests; public home, Phase 1 routes, aliases, planned phase page, and APIs passed live verification
- External blockers: none

## GEN-009 - Public Dataset References

- Date: 2026-07-05
- Status: dataset references deployed and validated
- Focus: official source links for Cranfield, BEIR, and Amazon ESCI, plus explicit source-not-selected status for behavior data
- Validation: local validation passed with 21 tests; public home, data, planned phase pages, metadata API, and search API passed live verification
- External blockers: none

## GEN-010 - Traceability And Versioning

- Date: 2026-07-06
- Status: traceability standard integrated and locally validated
- Focus: stable identifiers for Mission, Article, Search Evolution, Architecture Version, Architecture Decision Ledger, Git Tag, and versioned endpoints
- Validation: local validation passed with 21 tests; traceability validator checked 10 traceability files and canonical Phase 1 IDs
- External blockers: deploy approval required before `/api/v0.1/*` route changes are public; `v0.1.0` has been pushed at commit `baeae54`

## GEN-011 - Cranfield Failure Behavior Grouping

- Date: 2026-07-07
- Status: candidate architecture evaluated locally; public default unchanged
- Focus: query-level failure behavior grouping, candidate query architecture experiments, and comparison evidence
- Validation: local validation passed with 23 tests; live baseline/query-rescue/field-sum evaluations ran over 225 Cranfield queries with retrieval depth 50 and metrics at K=10
- Result: query-rescue regressed core metrics; field-sum improved MAP, nDCG@10, Precision@10, Recall@10, and MRR, but remains transferability-pending

## GEN-012 - Coverage Rerank Candidate

- Date: 2026-07-07
- Status: candidate architecture evaluated locally; public default unchanged
- Focus: drill into zero-relevant-at-10 failures and test deterministic title/abstract coverage reranking over field-sum top-50 retrieval
- Validation: local validation passed with 26 tests; live coverage-rerank evaluation ran over 225 Cranfield queries with retrieval depth 50 and metrics at K=10
- Result: coverage-rerank improved MAP to 0.2531, nDCG@10 to 0.3095, Precision@10 to 0.2502, Recall@10 to 0.4283, and MRR to 0.5520, but remains transferability-pending

## GEN-013 - PRF Rerank Candidate

- Date: 2026-07-07
- Status: candidate architecture evaluated locally; public default unchanged
- Focus: research-informed pseudo-relevance-feedback reranking over field-sum top-50 retrieval
- Validation: local node tests passed; live PRF rerank evaluation ran over 225 Cranfield queries with retrieval depth 50 and metrics at K=10
- Result: PRF rerank improved MAP to 0.2696, nDCG@10 to 0.3253, Precision@10 to 0.2676, Recall@10 to 0.4466, and MRR to 0.5620, making it the best Cranfield candidate at the time

## GEN-014 - Paper-BM25 Comparability Check

- Date: 2026-07-07
- Status: paper-comparable evaluation recorded; public default unchanged
- Focus: add binary relevance mode and a separate paper-style BM25 index profile to compare local OpenSearch results with the Cranfield BERT paper's NDCG@20 table
- Validation: local node tests passed; live binary NDCG@20 evaluations ran against default and paper-style BM25 indexes
- Result: paper-style BM25 plus PRF rerank reached binary NDCG@20 0.4547, below the paper BM25 0.4714 and BERT results 0.5525/0.5670; later refined in GEN-016

## GEN-015 - Evolution Traceability Repair

- Date: 2026-07-07
- Status: traceability repair validated
- Focus: align mission updates, evaluation timeline, search evolution timeline, architecture timeline, traceability registry, and experiment artifact index for GEN-013/GEN-014
- Validation: `npm run validate` passed with 30 node tests, MDE parsing, strengthened traceability validation, fixture index check, and fixture evaluation
- Result: candidate tag semantics clarified; metric-moving experiments must update the full trace chain before future work is considered complete

## GEN-016 - PRF Phrase Coherence Refinement

- Date: 2026-07-07
- Status: candidate architecture evaluated locally; public default unchanged
- Focus: test the next NDCG optimization after PRF rerank, including PRF-expanded retrieval and phrase-coherence refinement
- Validation: local node tests passed; live graded nDCG@10 and binary NDCG@20 evaluations ran over 225 Cranfield queries
- Result: PRF-expanded retrieval regressed to nDCG@10 0.3219 and is rejected; refined PRF rerank improved nDCG@10 to 0.3260 and paper-style binary NDCG@20 to 0.4563

## GEN-017 - Cached Retrieval Pool Fast Loop

- Date: 2026-07-07
- Status: evaluation infrastructure validated; public default unchanged
- Focus: speed up reranker optimization by caching live OpenSearch first-stage retrieval pools and tuning deterministic rerankers offline
- Validation: generated field-sum top-50 pools for all 225 Cranfield queries and reproduced the refined PRF phrase result from cache
- Result: cached tuning reproduced nDCG@10 0.3260 with phraseWeight 0.01; this is not a new metric improvement, but it is now the preferred fast loop before remote final validation

## GEN-018 - Vector Hybrid Embedding Candidate

- Date: 2026-07-07
- Status: vector/hybrid infrastructure validated; public default unchanged
- Focus: test whether embedding-style vector retrieval can improve Cranfield relevance and prepare a real LLM embedding path
- Validation: local-hash embedding cache generated for 1,400 documents and 225 queries; vector-only and hybrid evaluators ran against cached field-sum pools
- Result: local-hash vector-only nDCG@10 was 0.1453, best local-hash hybrid was 0.3054, and both remained below refined PRF nDCG@10 0.3260; GEN-018 had no real embedding result, and GEN-019 later resolved that gap with a local Ollama run

## GEN-019 - Local Ollama Embeddings

- Date: 2026-07-08
- Status: local Ollama embeddings evaluated; public default unchanged
- Focus: leverage the local Ollama instance behind `/Users/feroshjacob/codefj/local_llm` for real local Cranfield embeddings and compare vector/hybrid retrieval against refined PRF
- Validation: Ollama `llama3.1:8b` embedding cache generated for 1,400 documents and 225 queries using title+abstract text; vector-only, hybrid depth-50, hybrid depth-100, and binary k=20 evaluations ran against cached field-sum pools
- Result: Ollama vector-only nDCG@10 was 0.0282, best Ollama hybrid nDCG@10 was 0.3035, and best Ollama binary nDCG@20 was 0.4343; all remain below refined PRF nDCG@10 0.3260 and binary nDCG@20 0.4563, so `ARCH-0.3-candidate` is not promoted

## GEN-020 - Learning-To-Rank Candidate

- Date: 2026-07-08
- Status: LTR evaluated; public default unchanged
- Focus: test supervised learning-to-rank before neural reranking, using cached field-sum pools and cached Ollama similarities as optional features
- Validation: LTR feature tests passed; LTR ran with Ollama features and lexical/PRF-only ablations under query-grouped 5-fold cross-validation; binary k=20 comparison also ran
- Result: best cross-validated LTR improved field-sum but stayed below refined PRF, with graded nDCG@10 0.3166 versus 0.3260 and binary nDCG@20 0.4529 versus 0.4563; in-sample LTR exceeded refined PRF but is capacity evidence only, and cached Llama embeddings did not improve the ablation

## GEN-021 - Boosted-Tree LTR

- Date: 2026-07-08
- Status: boosted-tree LTR evaluated; public default unchanged
- Focus: test a stronger dependency-free LTR model before moving to neural reranking or external embedding models
- Validation: boosted-tree LTR tests passed; quick and depth-3 boosted-tree runs completed under query-grouped 5-fold cross-validation for graded nDCG@10 and binary nDCG@20
- Result: depth-3 boosted trees improved graded CV to nDCG@10 0.3216, closer to refined PRF 0.3260 but still below it; binary CV reached nDCG@20 0.4457, below lexical LTR 0.4529 and refined PRF 0.4563; in-sample boosted trees reached 0.3564/0.4840 and remain capacity evidence only

## GEN-022 - Hugging Face BGE Embeddings

- Date: 2026-07-08
- Status: BGE vector/hybrid and BGE-feature LTR evaluated above refined PRF offline; public default unchanged
- Focus: test dedicated Hugging Face retrieval embeddings after local Llama/Ollama embeddings and pointwise LTR failed to beat refined PRF
- Validation: Hugging Face embedding cache generated 1,400 document embeddings and 225 query embeddings; vector/hybrid and LTR evaluators ran for graded nDCG@10 and binary nDCG@20; full validation passed in VAL-032
- Result: BGE hybrid retrieval reached nDCG@10 0.3533 and binary nDCG@20 0.4915; BGE boosted-tree LTR reached cross-validated nDCG@10 0.3603 and binary nDCG@20 0.4910; remote OpenSearch vector/hybrid validation is required before promotion

## GEN-023 - Remote OpenSearch BGE Vector Validation

- Date: 2026-07-08
- Status: remote OpenSearch BGE vector/hybrid validated above refined PRF; public default unchanged
- Focus: validate the GEN-022 BGE vector/hybrid winner in a separate production-shaped OpenSearch kNN candidate index
- Validation: `cranfield-v0-bge-base-en-v15-gen023` was created and loaded with 1,400 Cranfield documents and 768-dimensional BGE vectors; remote OpenSearch vector-only, field-sum, and hybrid evaluations ran for graded nDCG@10 and binary nDCG@20; full validation passed in VAL-033
- Result: remote BGE hybrid reached graded nDCG@10 0.3533 and binary nDCG@20 0.4926, beating refined PRF 0.3260 / 0.4563 and matching or slightly exceeding the offline BGE hybrid results; `ARCH-0.3-candidate` remains candidate-only pending transferability and promotion policy

## GEN-024 - Milestone Search And Explain Endpoints

- Date: 2026-07-08
- Status: milestone endpoint aliases added locally and deployed in GEN-025
- Focus: expose stable comparison endpoints for the key Cranfield architecture milestones without changing the public/default route behavior
- Validation: Worker route tests verify `ARCH-0.1` baseline milestone routing, `ARCH-0.2-prf` explain routing, explicit `ARCH-0.3-bge` runtime limitation responses, and unknown milestone errors; no-runtime source scan passed; full validation passed in VAL-034
- Result: `/api/milestones/arch-0.1/search|explain` and `/api/milestones/arch-0.2-prf/search|explain` are functional aliases, while `/api/milestones/arch-0.3-bge/search|explain` returns `501 milestone_runtime_not_enabled` until runtime query-vector support or bounded known-query embeddings are implemented

## GEN-025 - Public Milestone Endpoint Deployment

- Date: 2026-07-09
- Status: milestone and versioned endpoints deployed and publicly verified
- Focus: deploy the approved GEN-024 route bundle without changing the public/default accepted baseline behavior
- Validation: local `npm run validate` passed with 45 tests; Cloudflare deployed Worker version `3e9597b9-f791-457f-805f-f1dbb8123a3c`; public `/health`, `/api/v0.1/search`, `/api/milestones/arch-0.1/search`, `/api/milestones/arch-0.2-prf/explain`, and `/api/milestones/arch-0.3-bge/search` passed verification after propagation
- Result: milestone comparison URLs are now public; `ARCH-0.3-bge` still honestly returns `501 milestone_runtime_not_enabled` until runtime query-vector generation or bounded known-query embeddings are implemented

## GEN-026 - Phase 1 Closure: Article Series Published

- Date: 2026-07-14
- Status: Phase 1 - Cranfield Foundation complete
- Focus: record publication of the full SLAB-RS Phase 1 article series and close the phase
- Validation: no code changes; Validation Gate had already passed twice (VAL-035); all four series articles verified live at https://feroshjacob.github.io/series/self-learning-agent-based-retail-search/ including Part 4 (A-0004), which was previously held for operator edits
- Result: the final Phase 1 deliverable (article linked to commit and endpoint) is fulfilled; Phase 2 - Transferability with BEIR is now the active phase, starting with planning

## GEN-027 - M-0002.1 Dataset-Agnostic Harness And First BEIR Baselines

- Date: 2026-07-14
- Status: M-0002.1 complete; Mission Updates 002 and 003 recorded
- Focus: dataset-agnostic loader/evaluator harness, BM25 baselines on SciFact and NFCorpus against published references, Cranfield migration to the shared interface
- Validation: Validation Gate passed twice (VAL-036, 53 tests); SciFact nDCG@10 0.6906 vs published 0.665 and NFCorpus 0.3273 vs published 0.325; Cranfield shared-harness parity exact (baseline 0.2995, prf-rerank 0.3260)
- Result: the harness is trustworthy per the Mission Update 002 sanity policy; every future dataset plugs in through the registry, and Cranfield plus BEIR are uniformly testable for every technique

## Next Action

M-0002.2: extend BM25 baselines across Tier 1-2 (FiQA-2018, ArguAna, SCIDOCS, then TREC-COVID, Touche-2020, CQADupStack, Quora) and Tier 3 sequentially, recording infra limits per dataset. Update the validation strategy to a Phase 2 version (VALSTRAT-007) covering BEIR evaluation. Per Mission Update 003, no article work unless Ferosh explicitly asks.
