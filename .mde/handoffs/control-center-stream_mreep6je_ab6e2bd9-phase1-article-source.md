# Phase 1 Article Source Material — Retail Search (Two-Part Series)

Handoff for: Control Center stream `stream_mreep6je_ab6e2bd9`
Project: `retail-search` (https://github.com/Northvalley-Intelligence/retail-search)
Compiled: 2026-07-10, from `MISSION.md`, `MISSION_UPDATES.md`, `docs/`, `experiments/cranfield-v0/`, `.mde/` state, and git history (GEN-001 through GEN-025 plus the 2026-07-09 public milestone UI work).
Audience: technical blog readers on feroshjacob.github.io. Contains no secrets, credentials, or client data — all URLs and numbers below are already public in the repo or on the live Worker.

**Traceability chain:** `M-0001` → `A-0002` → `SE-0001..SE-0004` → `ARCH-0.1` (released, `v0.1.0`) / `ARCH-0.2..0.4` (candidates) → `ADL-0001..ADL-0004`

**DRAFTS READY (2026-07-10):** full publication-ready drafts for both parts now exist in this repo:
- Part 1: `docs/articles/A-0003-phase1-part1-lexical-ceiling.md`
- Part 2: `docs/articles/A-0004-phase1-part2-embeddings-earn-their-place.md`
**Live system:** https://retail-search.feroshjacob.workers.dev (Cloudflare Worker → managed OpenSearch 3.3.2, `cranfield-v0` index)

**Project frame (use in both articles):** The mission is agent-driven search engineering on a *production-grade* stack — OpenSearch behind a Cloudflare Worker, public endpoints, public explain endpoints, and versioned experiment artifacts. Architecture is not designed upfront; every component must earn its place through measured evidence. Nothing ships to the public default without transferability evidence (Phase 2 BEIR), so Phase 1 ends with a released baseline plus a ladder of validated candidates.

---

## Operator angles (weave into both articles)

These framing points come from the operator's own review and should shape the series' voice:

1. **Team-quarter compression.** From the operator's experience running core search teams: the breadth of work in Phase 1 — corpus pipeline, managed OpenSearch setup, public API layer, evaluation harness, failure-behavior taxonomy, five lexical ranking experiments, three embedding providers, a kNN vector index, and two LTR trainers, all publicly deployed with traceability — would have taken a 10–15 person core search team several months to a quarter only a few years ago. Not because any single piece is hard, but because of the *coordination* cost: infra, relevance, API, evaluation, and ML-platform work normally live with different specialists, each handoff adding weeks. Here one agent loop executed all of it in six calendar days (2026-07-04 → 2026-07-09), with every step evidence-gated. The articles should show the *breadth of what was tried* — including the failures — because the catalog itself is the point.
2. **Pseudo-relevance feedback in production is rare — and it won the lexical round.** PRF ([relevance feedback](https://en.wikipedia.org/wiki/Relevance_feedback), the "blind"/pseudo variant) is a decades-old IR technique that almost never ships in production search systems: it needs a second scoring pass over the candidate pool, adds tail latency, and can drift the query when the top results are bad. It is genuinely interesting that on Cranfield it delivered the best *lexical* numbers of the whole ladder (nDCG@10 0.3260, +8.8% over baseline) with a deterministic, LLM-free, single-retrieval implementation (feedback terms are extracted from the already-retrieved top-50 pool, so there is no second OpenSearch round trip). Precision of claim for the article: PRF is the best **lexical** result; the overall Phase 1 best is the BGE hybrid (0.3533). The "why don't production teams do this?" question is a strong article hook — and this implementation answers the usual latency objection.

---

## How every experiment was executed — the repeatable loop

Explain this process *before* listing the experiments; it is what makes the catalog trustworthy. Every generation (GEN-011 → GEN-023) followed the same loop:

1. **Start from observed failures, not ideas.** The evaluator classifies all 225 live queries into behavior groups (zero-relevant-at-10, late-first-relevant, lexical noise, broad-need-low-recall, partial recall, graded ranking loss). Each experiment targets named groups.
2. **State the hypothesis and its mechanism.** e.g. "zero-relevant queries mostly have a relevant doc at ranks 11–50, so a wider pool plus a deterministic rerank should surface them."
3. **Implement behind an opt-in architecture flag.** Every candidate is selectable via `?architecture=` (and later stable milestone routes); the public default `/api/search` stays on the accepted baseline throughout. No experiment can regress the live system.
4. **Evaluate live, all queries, fixed protocol.** Metrics run against the real managed OpenSearch index over all 225 Cranfield queries at k=10 graded (plus a paper-comparable binary nDCG@20 profile), never a subsample. From GEN-017 on, reranker tuning ran offline against cached top-50 retrieval pools, with remote OpenSearch reserved for final validation of winners.
5. **Compare against the current best, then decide.** Accept as candidate, or record as *rejected evidence* — rejected runs (query-rescue, PRF-expand, chat-model embeddings) keep their artifacts and ledger entries permanently.
6. **Write the evidence trail in the same generation.** Evaluation JSON in `experiments/cranfield-v0/`, a Search Evolution entry (SE-000x), an Architecture Decision Ledger entry (ADL-000x), a mission update, and traceability registry updates — enforced by a validator that fails the build when the chain breaks.
7. **Gate before "done."** Each generation passes the project Validation Gate twice (second pass re-runs all Critical checks with no code changes between passes) before its results are reported.

This loop *is* the coordination layer that normally requires a team: the failure taxonomy is the relevance analyst, the opt-in flags are the release manager, the cached pools are the ML-platform team, and the ledger is the tech lead's design-review trail.

## Complete experiment catalog — everything the agent tried

| # | Gen | Experiment | Technique (reference) | Process in one line | Result (nDCG@10 unless noted) | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | GEN-003 | BM25 baseline | [Okapi BM25](https://en.wikipedia.org/wiki/Okapi_BM25) multi_match, field boosts | Index 1,400 docs, evaluate all 225 queries live | 0.2995 | **Released** (ARCH-0.1) |
| 2 | GEN-011 | query-rescue | [Query expansion](https://en.wikipedia.org/wiki/Query_expansion)-style phrase/proximity + all-keyword boosts | Add boost clauses targeting zero-relevant and late-relevant groups | regressed all metrics | **Rejected**, kept as evidence |
| 3 | GEN-011 | field-sum | per-field BM25 score summation (vs best-field) | Replace best_fields with summed per-field match clauses | 0.3022 | Candidate |
| 4 | GEN-012 | coverage-rerank | deterministic term-coverage reranking | Retrieve top 50, add title/abstract query-term coverage bonus | 0.3095 | Candidate |
| 5 | GEN-013 | prf-rerank | [pseudo-relevance feedback](https://en.wikipedia.org/wiki/Relevance_feedback) (cf. [Rocchio](https://en.wikipedia.org/wiki/Rocchio_algorithm)/RM3 family) | Top 4 hits → 8 feedback terms → rerank pool by original+feedback coverage | 0.3253 | Candidate |
| 6 | GEN-014 | paper-BM25 comparability | BM25 k1=1.5, b=0.75, binary qrels, nDCG@20 | Separate index tuned to a published Cranfield BERT paper's protocol | binary nDCG@20 0.4547 | Measurement, not a candidate |
| 7 | GEN-016 | PRF-expanded second retrieval | two-pass [query expansion](https://en.wikipedia.org/wiki/Query_expansion) retrieval | Re-query OpenSearch with feedback-term clauses, merge pools, rerank | 0.3219 (< 0.3253) | **Rejected**, kept as evidence |
| 8 | GEN-016 | phrase-coherence bonus | adjacent-term proximity scoring | Grid-tune phrase weight offline on cached pools; ship at 0.01 | 0.3260 | Candidate (refined PRF, lexical best) |
| 9 | GEN-018 | local-hash vectors (control) | deterministic hash embeddings | Control run to validate vector harness with no real model | vector-only 0.1453; hybrid 0.3054 | Control, below PRF |
| 10 | GEN-019 | Ollama chat-model embeddings | [word/sentence embeddings](https://en.wikipedia.org/wiki/Sentence_embedding) from llama3.1:8b (4,096-dim) | Embed title+abstract locally via Ollama, evaluate vector + hybrid | vector-only 0.0282; hybrid 0.3035 | **Rejected** — chat LLM ≠ retrieval encoder |
| 11 | GEN-020 | coordinate-ascent LTR | [learning to rank](https://en.wikipedia.org/wiki/Learning_to_rank) via [coordinate descent](https://en.wikipedia.org/wiki/Coordinate_descent); [5-fold CV](https://en.wikipedia.org/wiki/Cross-validation_(statistics)) | Train on lexical + embedding features over cached top-50 pools | CV 0.3166 (in-sample 0.3338) | Below PRF; infrastructure kept |
| 12 | GEN-020 | oracle/headroom analysis | candidate-pool oracle metrics | Compute best-possible reordering of top-50 pools | oracle 0.7033, pool recall 0.6042 | Diagnostic — proved ranking headroom |
| 13 | GEN-021 | boosted-tree LTR | [gradient boosting](https://en.wikipedia.org/wiki/Gradient_boosting) (pointwise, dependency-free) | Same features and CV protocol as #11 | CV 0.3216 (in-sample 0.3564, [overfitting](https://en.wikipedia.org/wiki/Overfitting) evidence) | Below PRF; infrastructure kept |
| 14 | GEN-022 | BGE retrieval embeddings | retrieval-tuned encoder BAAI/bge-base-en-v1.5 (768-dim) | SentenceTransformers bridge, query prefix, offline vector/hybrid eval | vector-only 0.3419; hybrid 0.3533 | **First to beat lexical ceiling** |
| 15 | GEN-022 | BGE-feature LTR | LTR over BGE similarity features | Re-run #11/#13 trainers with BGE features added | CA 0.3541; boosted trees 0.3603 (CV) | Best CV result; candidate-adjacent |
| 16 | GEN-023 | remote OpenSearch kNN validation | [k-NN](https://en.wikipedia.org/wiki/K-nearest_neighbors_algorithm) / [ANN](https://en.wikipedia.org/wiki/Nearest_neighbor_search) vector index (768-dim), hybrid fusion | Load embeddings into separate live index, re-run full eval | hybrid 0.3533 (= offline); binary nDCG@20 0.4926 | Candidate (ARCH-0.3), production-shaped |

Sixteen experiments, four explicit rejections, one released architecture, three candidate architectures — in six days, every row reproducible from a JSON artifact in `experiments/cranfield-v0/`.

---

## PART 1 — Before Embeddings: Corpus, BM25, Evaluation Harness, and Lexical Ceiling

Covers GEN-001 → GEN-017 (2026-07-04 → 2026-07-07). Everything here is lexical: no vectors, no neural models, no LLM in any live path.

### Chronological narrative

**Foundation (GEN-001 → GEN-004, Jul 4–5).**
- GEN-001: public GitHub repo, Cloudflare-Worker-compatible Cranfield search + explain endpoints generating OpenSearch requests, index mapping, baseline evaluator, first architecture decision (ADL-0001: start with a transparent OpenSearch BM25 baseline before any query understanding or ranking layers).
- GEN-002: reproducible corpus export from the public Glasgow Cranfield collection (`ir_datasets` id `cranfield`): **1,400 documents, 225 evaluation queries, 1,837 relevance judgments**. Documented the managed OpenSearch setup and credential split without deploying.
- GEN-003: live managed OpenSearch (3.3.2, green cluster), created `cranfield-v0` with an English analyzer and field boosts (title×3, abstract×2, text×1), bulk-loaded all 1,400 docs, and ran the first live evaluation over all 225 queries — **MAP 0.2402, nDCG@10 0.2995, Precision@10 0.2316, Recall@10 0.3994, MRR 0.5350**. This is the ARCH-0.1 baseline every later number is measured against.
- GEN-004: deployed the Worker publicly and verified `/health`, `/api/search`, `/api/explain` against the live index. Phase 1 became a working public system in two days.

**Transparency layer (GEN-005 → GEN-010, Jul 5–6).**
- Public search UI, dataset metadata endpoints, a six-step explain flow (Query → Normalize → OpenSearch Query → Retrieve → Rank → Explain), public evaluation page with strong/mixed/weak example queries, phase-organized pages, and official dataset references.
- GEN-010 added the traceability standard: stable IDs (M-/A-/SE-/ARCH-/ADL-), git tag `v0.1.0`, versioned `/api/v0.1/*` aliases, and a validator (`scripts/validate-traceability.mjs`) that fails the build if the cross-reference chain breaks.

**From aggregate metrics to failure behaviors (GEN-011, Jul 7).** The pivotal move of Part 1. Instead of tuning blindly against MAP, the evaluator was extended to classify every failing query by *observed retrieval behavior*:

| Behavior group | Queries (baseline) |
| --- | ---: |
| passing_or_minor | 64 |
| late_first_relevant (first hit below rank 3) | 42 |
| zero_relevant_at_k (nothing relevant in top 10) | 28 |
| lexical_noise_low_precision | 27 |
| broad_need_low_recall | 25 |
| partial_recall | 23 |
| graded_ranking_loss | 16 |

Two candidates targeted these groups. `query-rescue` (phrase/proximity + all-keyword boost clauses) **regressed every core metric and was kept as rejected evidence**. `field-sum` (separate summed BM25 clauses per field instead of best_fields) improved everything: MAP 0.2402 → 0.2452, nDCG@10 0.2995 → **0.3022**.

**The rerank ladder (GEN-012 → GEN-016, Jul 7).**
- GEN-012 drilled into the 28 zero-relevant queries: 19 had a judged-relevant doc at ranks 11–50, 9 had none in the top 50 — i.e., mostly a *ranking* problem, partly a *vocabulary* problem. `coverage-rerank` (retrieve top 50 with field-sum, add a deterministic title/abstract query-term coverage bonus) lifted nDCG@10 to **0.3095** — but only moved zero-relevant from 28 → 27, confirming the residue is vocabulary mismatch that lexical tricks can't fix.
- GEN-013: `prf-rerank` — treat the top 4 hits as pseudo-relevant, extract 8 feedback terms, rerank the top-50 pool with normalized BM25 + original-term + feedback-term coverage. nDCG@10 **0.3253**, all metrics up (MAP 0.2696, P@10 0.2676, R@10 0.4466, MRR 0.5620). Worth dwelling on in the article: pseudo-relevance feedback is textbook IR that production search teams almost never ship (latency of a second pass, query-drift risk) — yet implemented as a deterministic rerank over the already-retrieved pool it added no extra OpenSearch round trip and became the strongest lexical technique of the whole phase.
- GEN-014: comparability check against a published Cranfield BERT paper using binary relevance and paper-style BM25 (k1=1.5, b=0.75) on a separate index. Our PRF stack reached binary **nDCG@20 0.4547** vs the paper's BM25 0.4714, BERT re-ranker 0.5525, BERT full-ranker 0.5670 — honest positioning: better than our own baseline, still below the paper's BM25 and far below BERT.
- GEN-016: a second PRF-expanded retrieval pass **regressed** (0.3219 vs 0.3253) and was rejected; a tuned phrase-coherence bonus (weight 0.01) nudged the refined PRF to **nDCG@10 0.3260** / binary nDCG@20 **0.4563** — the final lexical ceiling.
- GEN-017: cached top-50 retrieval pools (`npm run cache:cranfield`) so reranker tuning runs offline against artifacts instead of hammering remote OpenSearch — the workhorse for everything in Part 2.

### Key decisions and why
- **BM25 on OpenSearch before anything clever (ADL-0001):** a production engine and a measured baseline make every later claim falsifiable.
- **Public-by-default:** endpoints, explain payloads, and evaluation artifacts published from day one; the explain endpoint reports the generated OpenSearch query, active architecture, decisions involved, and per-result rationale.
- **Failure-group analysis before candidates (ADL-0002):** hypotheses target observed behaviors, not hunches; rejected candidates (query-rescue, PRF-expand) are kept as permanent evidence.
- **Candidates stay candidates:** nothing is promoted to the public default without Phase 2 BEIR transferability evidence. The released architecture is still ARCH-0.1; refined PRF is `ARCH-0.2-candidate`, untagged by design.

### Numbers (all live, 225 queries, k=10 graded unless noted)

| Stage | MAP | nDCG@10 | P@10 | R@10 | MRR |
| --- | ---: | ---: | ---: | ---: | ---: |
| ARCH-0.1 BM25 baseline | 0.2402 | 0.2995 | 0.2316 | 0.3994 | 0.5350 |
| field-sum | 0.2452 | 0.3022 | 0.2418 | 0.4136 | 0.5499 |
| coverage-rerank | 0.2531 | 0.3095 | 0.2502 | 0.4283 | 0.5520 |
| prf-rerank | 0.2696 | 0.3253 | 0.2676 | 0.4466 | 0.5620 |
| refined PRF (phrase coherence) | 0.2699 | 0.3260 | 0.2680 | 0.4469 | 0.5622 |

Rejected along the way: query-rescue (regressed all metrics), PRF-expanded second retrieval (0.3219 < 0.3253).

### Lessons learned
- Aggregate metrics hide the story; grouping failures by behavior turned "make MAP better" into six specific, attackable problems.
- The first plausible idea (query-rescue) lost to the boring one (field-sum) — evidence beats intuition.
- Deterministic reranking over a wider candidate pool is cheap and effective, but each lexical layer bought less: +0.9% → +2.4% → +5.1% → +0.2% nDCG@10 — a visible asymptote.
- The stubborn zero-relevant group (27 queries) is vocabulary mismatch; no amount of term-overlap engineering fixes words that never co-occur. That's the cliffhanger for Part 2.
- Offline tuning against cached retrieval pools made iteration ~free after GEN-017.

### Suggested takeaways (Part 1)
1. Ship the baseline publicly first: a live, explainable BM25 system is the measuring stick that makes every later improvement honest.
2. Classify failures by behavior before proposing fixes — the failure taxonomy, not the metric, tells you what to build.
3. Keep rejected experiments as first-class artifacts; the rejection record is what makes accepted decisions credible.
4. Lexical reranking has a ceiling, and you can measure yourself hitting it (+8.8% nDCG@10 total, with the last refinement worth +0.2%).

---

## PART 2 — Embeddings and Neural Advances: From Hash Vectors to a Production-Shaped BGE Hybrid

Covers GEN-018 → GEN-025 plus the public milestone/explain UI (2026-07-07 → 2026-07-09). Baseline to beat throughout: **refined PRF nDCG@10 0.3260 / binary nDCG@20 0.4563**.

### Chronological narrative

**Infrastructure with a control group (GEN-018, Jul 7).** Built the embedding cache (`npm run embed:cranfield`) and vector/hybrid evaluator before spending on any real model, using deterministic `local-hash` vectors as a control: vector-only nDCG@10 **0.1453**, best hybrid **0.3054** — both below PRF, proving the harness worked and that gains would have to come from the model, not the plumbing.

**Chat-model embeddings fail (GEN-019, Jul 8).** Real local embeddings from Ollama `llama3.1:8b` (4,096 dims, title+abstract): vector-only nDCG@10 **0.0282** — dramatically worse than hash vectors. Best hybrid 0.3035, still below PRF. Clear negative result: embeddings pulled from a chat LLM are not retrieval embeddings.

**Is it a ranking problem? LTR detour (GEN-020 → GEN-021, Jul 8).** Before buying better embeddings, quantify headroom: over the cached field-sum top-50 pools, query coverage is 0.9644 and **oracle nDCG@10 is 0.7033** (vs 0.3260 achieved) — enormous reordering headroom, though pool recall of 0.6042 caps the ceiling. Coordinate-ascent LTR with query-grouped 5-fold CV: best graded nDCG@10 **0.3166** — below PRF; Ollama-embedding features didn't help. Gradient-boosted trees (GEN-021): CV **0.3216**, still below PRF, while in-sample hit 0.3564 — capacity without generalization on 225 queries. Discipline: in-sample numbers are recorded as capacity evidence only.

**The breakthrough: purpose-built embeddings (GEN-022, Jul 8).** `BAAI/bge-base-en-v1.5` via a local SentenceTransformers bridge (768 dims, title+abstract, retrieval query prefix). First path to beat the lexical ceiling:
- BGE vector-only: nDCG@10 **0.3419** (beats PRF on its own)
- BGE hybrid (with field-sum BM25): nDCG@10 **0.3533**, binary nDCG@20 **0.4915**
- BGE-feature LTR under CV: coordinate ascent 0.3541, boosted trees **0.3603** — the same LTR that failed with lexical/Ollama features now works, because the features finally carry semantic signal.

**Production-shaped validation (GEN-023, Jul 8).** Offline wins can be artifacts of the harness, so the embeddings were loaded into a separate remote OpenSearch kNN index (`cranfield-v0-bge-base-en-v15-gen023`, 768-dim vector field; the public index untouched). Live OpenSearch hybrid reproduced the offline result exactly — graded nDCG@10 **0.3533**, binary nDCG@20 **0.4926** (slightly above offline). ARCH-0.3-candidate became the best production-shaped candidate.

**Public, honest milestones (GEN-024 → GEN-025 + Jul 9 UI).** Stable milestone endpoints expose the architecture ladder publicly: `/api/milestones/arch-0.1/*` (baseline), `/api/milestones/arch-0.2-prf/*` (refined PRF live), `/api/milestones/arch-0.3-bge/*` — which deliberately returns **501 `milestone_runtime_not_enabled`**, because live arbitrary-query BGE search needs runtime query-vector generation the Worker doesn't have yet; instead it serves validated evidence and archived demo samples. The explain page now runs the same query through all milestones side by side, showing each architecture's own retrieval flow (PRF: query → normalize → build → retrieve → rank → **feedback → rerank** → explain), the PRF feedback terms discovered for the query, and rank movement caused by reranking.

### Key decisions and why
- **Controls before models (ADL-0003):** hash-vector and chat-model runs isolated harness effects from model quality; negative results were published, not discarded.
- **Oracle analysis before LTR:** measuring the reordering ceiling (0.7033) justified investing in ranking work and later explained *why* better features were the unlock.
- **Remote validation before claiming a candidate:** the offline/remote agreement (0.3533 = 0.3533) is the difference between "notebook result" and "production-shaped candidate."
- **501 over fake demo:** the BGE milestone refuses to pretend; it reports status, evidence artifacts, and the next implementation step. Still not promoted to the public default — transferability (BEIR), latency/cost, and runtime query embedding remain open.

### Numbers (baseline to beat: refined PRF 0.3260 graded / 0.4563 binary nDCG@20)

| Approach | Graded nDCG@10 | vs PRF |
| --- | ---: | --- |
| local-hash vector-only (control) | 0.1453 | −55% |
| Ollama llama3.1:8b vector-only | 0.0282 | −91% |
| Ollama best hybrid | 0.3035 | below |
| LTR coordinate ascent, lexical features (CV) | 0.3166 | below |
| LTR boosted trees, lexical features (CV) | 0.3216 | below |
| **BGE vector-only** | **0.3419** | **+4.9%** |
| **BGE hybrid (offline and remote OpenSearch)** | **0.3533** | **+8.4%** |
| **LTR boosted trees + BGE features (CV)** | **0.3603** | **+10.5%** |

Paper-comparable binary nDCG@20 context: our baseline 0.4187 → refined PRF 0.4563 → **remote BGE hybrid 0.4926**; the reference paper reports BM25 0.4714, BERT re-ranker 0.5525, BERT full-ranker 0.5670. The BGE hybrid is the first configuration to beat the paper's BM25.

### Lessons learned
- Embedding quality is a property of the model's training objective, not its size: an 8B chat model's 4,096-dim embeddings (0.0282) lost to a 768-dim retrieval-tuned encoder (0.3419) by more than 10×.
- Hybrid beats pure-vector everywhere: BM25 and dense retrieval fail on different queries; fusing them was worth +0.011 nDCG@10 over BGE alone.
- LTR is only as good as its features — the identical training loop went from "below PRF" to "best result" when BGE similarities were added.
- Cross-validation discipline matters at small scale: on 225 queries, in-sample gains of +0.03–0.05 nDCG@10 evaporated under query-grouped CV.
- Cached pools + cached embeddings meant GEN-020 through GEN-022 ran without regenerating anything — cheap iteration is a design choice.

### Suggested takeaways (Part 2)
1. Run cheap controls (hash vectors, chat-model embeddings) before paying for real ones — negative results are what make the eventual win believable.
2. "Semantic search" is not one thing: the gap between a chat LLM's embeddings and a retrieval-tuned encoder was the entire difference between failure and breakthrough.
3. Validate vector wins on the production engine (OpenSearch kNN), not just offline — and be suspicious until the numbers agree.
4. Ship honesty: a 501 with evidence and a stated next step is a better public artifact than a demo that fakes live inference.

---

## Cross-part connective tissue (for the series intro/outro)

- Part 1 ends on the unresolved 27 zero-relevant queries (vocabulary mismatch) — Part 2 opens by attacking exactly that with embeddings.
- Running totals: baseline 0.2995 → lexical ceiling 0.3260 (+8.8%) → BGE hybrid 0.3533 (+18.0% over baseline) → BGE-LTR 0.3603 (+20.3%, CV).
- Everything is inspectable: live milestone comparison at https://retail-search.feroshjacob.workers.dev/phases/cranfield/explain, JSON milestone endpoints, per-generation artifacts in `experiments/cranfield-v0/`, decisions in `docs/architecture/decisions/`, evolution log in `MISSION_UPDATES.md`.
- Open threads to tease the next article: Phase 2 BEIR transferability gate (nothing promotes without it), runtime query-vector generation for live BGE search, latency/cost policy for hybrid retrieval.

## IR technique references for readers (link on first mention)

For blog readers who are not IR practitioners, link these Wikipedia articles the first time each concept appears:

- Foundations: [Information retrieval](https://en.wikipedia.org/wiki/Information_retrieval) · [Cranfield experiments](https://en.wikipedia.org/wiki/Cranfield_experiments) (the 1960s methodology this dataset comes from — nice historical hook: the field's oldest test collection evaluating its newest tooling) · [Vector space model](https://en.wikipedia.org/wiki/Vector_space_model) · [tf–idf](https://en.wikipedia.org/wiki/Tf%E2%80%93idf)
- Lexical ranking: [Okapi BM25](https://en.wikipedia.org/wiki/Okapi_BM25) · [Query expansion](https://en.wikipedia.org/wiki/Query_expansion) · [Relevance feedback](https://en.wikipedia.org/wiki/Relevance_feedback) (covers pseudo/blind feedback) · [Rocchio algorithm](https://en.wikipedia.org/wiki/Rocchio_algorithm)
- Evaluation: [Evaluation measures (information retrieval)](https://en.wikipedia.org/wiki/Evaluation_measures_(information_retrieval)) (MAP, precision, recall) · [Discounted cumulative gain](https://en.wikipedia.org/wiki/Discounted_cumulative_gain) (nDCG) · [Mean reciprocal rank](https://en.wikipedia.org/wiki/Mean_reciprocal_rank) · [Precision and recall](https://en.wikipedia.org/wiki/Precision_and_recall) · [Cross-validation](https://en.wikipedia.org/wiki/Cross-validation_(statistics)) · [Overfitting](https://en.wikipedia.org/wiki/Overfitting)
- Neural/vector: [Sentence embedding](https://en.wikipedia.org/wiki/Sentence_embedding) · [Word embedding](https://en.wikipedia.org/wiki/Word_embedding) · [k-nearest neighbors](https://en.wikipedia.org/wiki/K-nearest_neighbors_algorithm) · [Nearest neighbor search](https://en.wikipedia.org/wiki/Nearest_neighbor_search) (ANN) · [HNSW](https://en.wikipedia.org/wiki/Hierarchical_navigable_small_world) (the index OpenSearch kNN uses)
- Ranking models: [Learning to rank](https://en.wikipedia.org/wiki/Learning_to_rank) · [Gradient boosting](https://en.wikipedia.org/wiki/Gradient_boosting) · [Coordinate descent](https://en.wikipedia.org/wiki/Coordinate_descent)

No good Wikipedia article exists for reciprocal rank fusion (RRF) or BEIR; when those come up, link the BEIR GitHub repo (https://github.com/beir-cellar/beir) and describe RRF in a sentence instead.

## Source pointers for the author

- Chronology + all metrics: `MISSION_UPDATES.md` (GEN-001 → GEN-025)
- Failure taxonomy: `docs/evaluation/cranfield-failure-groups.md`
- Decisions: `docs/architecture/decisions/ADL-0001..0004*.md`
- Experiment evidence: `experiments/cranfield-v0/*.json` (per-generation evaluation artifacts)
- Research notes: `docs/evaluation/cranfield-prf-rerank-research.md`, `cranfield-vector-hybrid-research.md`, `cranfield-ltr-research.md`
- Existing article drafts for tone/precedent: `docs/articles/phase-1-cranfield-baseline.md`, `docs/articles/A-0002-baseline-before-agents.md`
- Live endpoints: home https://retail-search.feroshjacob.workers.dev, explain comparison `/phases/cranfield/explain`, milestone APIs `/api/milestones/{arch-0.1,arch-0.2-prf,arch-0.3-bge}/{search,explain}`
