# A-0003 — A Quarter of Search Engineering in Six Days, Part 1: Failure-Driven BM25 and the Lexical Ceiling

Status: draft ready for publishing handoff (target: feroshjacob.github.io)
Series: Phase 1 advances, part 1 of 2 (part 2: `A-0004`)
Source handoff: `.mde/handoffs/control-center-stream_mreep6je_ab6e2bd9-phase1-article-source.md`

Cross references:

- Mission: `M-0001`
- Search Evolution: `SE-0001`, `SE-0002`
- Architecture: `ARCH-0.1` (released), `ARCH-0.2-candidate`
- Decisions: `ADL-0001`, `ADL-0002`
- Git Tag: `v0.1.0` · Git Commit: `baeae54` (baseline), `73714a4` (latest)
- Live system: https://retail-search.feroshjacob.workers.dev
- Milestone endpoints: `/api/milestones/arch-0.1/search`, `/api/milestones/arch-0.2-prf/explain`
- Experiment artifacts: `experiments/cranfield-v0/`

---

## Draft

A few years ago, the work in this article would have been a quarter's roadmap for a core search team of ten to fifteen people: corpus pipeline, managed cluster setup, a public API layer, an evaluation harness, a failure taxonomy, five ranking experiments, and a public deployment with full traceability. Not because any single piece is hard — but because in a real organization those pieces belong to different specialists, and every handoff between infra, relevance, API, and evaluation costs weeks.

An AI agent did all of it in six calendar days, and this two-part series is the evidence trail. Part 1 covers everything before neural networks: building a production-shaped [BM25](https://en.wikipedia.org/wiki/Okapi_BM25) baseline, instrumenting it so failures are inspectable, and then climbing a ladder of lexical improvements until the ladder ran out. Part 2 covers what happened when embeddings entered the picture.

One rule shaped everything: **architecture is the result of validated missions, not the starting point.** No query understanding, no learning-to-rank, no semantic search was assumed. Every component had to earn its place with measured evidence — and everything, including the failures, is public.

### The setup: a real engine, a real API, a historic dataset

The stack is deliberately production-shaped rather than notebook-shaped: a managed [OpenSearch](https://opensearch.org/) cluster does retrieval, a Cloudflare Worker serves the public API, and every experiment ships as a versioned JSON artifact in the open [GitHub repository](https://github.com/Northvalley-Intelligence/retail-search).

The dataset is a deliberate wink at history: [Cranfield](https://en.wikipedia.org/wiki/Cranfield_experiments), the 1960s aeronautics collection that invented modern retrieval evaluation — 1,400 documents, 225 queries, and 1,837 graded relevance judgments. The field's oldest test collection, evaluating its newest tooling.

Day one and two produced the foundation: a reproducible corpus export, an OpenSearch index with an English analyzer and field boosts (title ×3, abstract ×2, body ×1), public search and explain endpoints, and a first live evaluation over all 225 queries:

| Metric | ARCH-0.1 baseline |
| --- | ---: |
| MAP | 0.2402 |
| nDCG@10 | 0.2995 |
| Precision@10 | 0.2316 |
| Recall@10 | 0.3994 |
| MRR | 0.5350 |

(If those acronyms are new: [evaluation measures in IR](https://en.wikipedia.org/wiki/Evaluation_measures_(information_retrieval)), [nDCG](https://en.wikipedia.org/wiki/Discounted_cumulative_gain), [MRR](https://en.wikipedia.org/wiki/Mean_reciprocal_rank), [precision and recall](https://en.wikipedia.org/wiki/Precision_and_recall).)

Two things make this baseline more than a demo. First, it is live — you can query it right now at [retail-search.feroshjacob.workers.dev](https://retail-search.feroshjacob.workers.dev). Second, every response carries an explain payload: the generated OpenSearch query, the active architecture version, the ranking decisions involved, and per-result rationale. Transparency was a deliverable, not an afterthought.

### The process: how every experiment was run

Before listing what was tried, here is the loop that every experiment followed — because the loop is what makes the results trustworthy, and it is also exactly the coordination work that normally requires a team:

1. **Start from observed failures, not ideas.** The evaluator classifies all 225 queries by retrieval behavior, so experiments target named problems.
2. **State the hypothesis and its mechanism** before writing code.
3. **Implement behind an opt-in flag.** Every candidate is selectable via a query parameter; the public default never changes mid-experiment. No experiment can regress the live system.
4. **Evaluate live, all queries, fixed protocol.** Never a subsample, always against the real cluster.
5. **Compare against the current best, then decide** — accept as a candidate, or record as *rejected evidence* with its artifacts kept permanently.
6. **Write the evidence trail in the same generation:** evaluation JSON, a Search Evolution entry, an Architecture Decision Ledger entry, and a mission update, enforced by a validator that fails the build if the chain breaks.
7. **Gate twice** before reporting: the validation suite must pass twice with no code changes in between.

The failure taxonomy plays the relevance analyst, the opt-in flags play the release manager, the ledger plays the design-review trail. That is where the team-quarter compression comes from.

### Step one: stop staring at averages

The single most valuable move of the whole phase was not a ranking technique. It was reworking the evaluator so that every failing query lands in a behavior group:

| Behavior group | Queries |
| --- | ---: |
| passing_or_minor | 64 |
| late_first_relevant (first hit exists but below rank 3) | 42 |
| zero_relevant_at_k (nothing relevant in the top 10) | 28 |
| lexical_noise_low_precision | 27 |
| broad_need_low_recall | 25 |
| partial_recall | 23 |
| graded_ranking_loss | 16 |

"Make MAP better" is not actionable. "42 queries rank their first relevant hit too low" and "28 queries retrieve nothing relevant at all" are hypotheses waiting to happen.

### The ladder: five experiments, two rejections

**query-rescue — rejected.** The first, most intuitive idea: add phrase-proximity and all-keyword boost clauses ([query expansion](https://en.wikipedia.org/wiki/Query_expansion) thinking) to rescue the zero-relevant group. It regressed every core metric. The artifacts stay in the repo as permanent rejected evidence — the first proof the process was honest.

**field-sum — accepted as candidate.** The boring counterpart won: replace the single best-field query with summed per-field BM25 clauses, so evidence spread across title, abstract, and text accumulates instead of competing. nDCG@10: 0.2995 → **0.3022**, everything else up too.

**coverage-rerank — accepted as candidate.** Drilling into the 28 zero-relevant queries showed 19 of them had a judged-relevant document sitting at ranks 11–50 — a *ranking* problem, not a recall problem. So: retrieve the top 50, apply a small deterministic title/abstract term-coverage bonus, return the reordered top results. nDCG@10 **0.3095**. But the zero-relevant count only moved from 28 to 27 — the residue is vocabulary mismatch, and no amount of term counting fixes words that never co-occur. Remember that number; it is the cliffhanger.

**prf-rerank — the surprise winner.** [Pseudo-relevance feedback](https://en.wikipedia.org/wiki/Relevance_feedback) is textbook IR from the [Rocchio](https://en.wikipedia.org/wiki/Rocchio_algorithm) lineage: assume the top few results are probably relevant, mine them for vocabulary, and use that vocabulary to re-score. It is also a technique that production search teams almost never ship — a second scoring pass adds tail latency, and bad top results can drift the query off-target.

Here it was implemented as a deterministic rerank *within* the already-retrieved top-50 pool: take the top 4 hits, extract 8 feedback terms from their titles and abstracts, then re-score the pool on normalized BM25 plus original-term and feedback-term coverage. No second OpenSearch round trip, no model call, fully explainable. Result: nDCG@10 **0.3253**, with every other metric up (MAP 0.2696, MRR 0.5620).

That a decades-old, rarely-productionized technique became the strongest lexical move of the phase — with the usual latency objection engineered away — is one of the most interesting outcomes of Part 1.

**PRF-expanded retrieval — rejected.** The obvious next step, issuing a second OpenSearch query expanded with the feedback terms, *regressed* (0.3219 vs 0.3253). Kept as rejected evidence. The cheap version of the idea was the right version.

**Phrase coherence — the last +0.2%.** A grid-tuned bonus for adjacent query terms appearing as phrases nudged the refined PRF candidate to nDCG@10 **0.3260**. Tuning ran offline against cached top-50 retrieval pools — after day four, iterating on rerankers cost nothing but CPU.

### Reality check against the literature

To avoid grading its own homework, the project also built a comparability profile matching a published Cranfield BERT study (binary relevance, BM25 k1=1.5/b=0.75, nDCG@20). On that scale the refined PRF stack reaches **0.4563**, versus the paper's BM25 at 0.4714 and its BERT re-ranker at 0.5525. Honest position: our lexical ladder closed most of the gap to reference BM25 but stayed well below neural rerankers. The gap is quantified, not hand-waved — and it sets up Part 2.

### Where Part 1 ends

| Stage | nDCG@10 | vs baseline |
| --- | ---: | ---: |
| BM25 baseline (ARCH-0.1, released) | 0.2995 | — |
| field-sum | 0.3022 | +0.9% |
| coverage-rerank | 0.3095 | +3.3% |
| prf-rerank | 0.3253 | +8.6% |
| refined PRF (lexical ceiling) | 0.3260 | +8.8% |

Look at the increments: each lexical layer bought less than the last, and the final refinement was worth two tenths of a percent. That is what hitting a ceiling looks like in data. And 27 queries still retrieve nothing relevant in the top 10, because their vocabulary simply does not overlap with their relevant documents.

Every stage above is live and comparable side by side on the [explain page](https://retail-search.feroshjacob.workers.dev/phases/cranfield/explain), which runs your query through each architecture milestone and shows the flow, the feedback terms PRF discovered, and which results the rerank moved.

The released architecture at the end of Part 1 is still the baseline — deliberately. Nothing is promoted to the public default without transferability evidence on a second dataset (that gate is Phase 2). The candidates wait, tagged and reproducible.

**Takeaways:**

1. Ship the baseline publicly first — a live, explainable system is the measuring stick that keeps every later claim honest.
2. Classify failures by behavior before proposing fixes; the taxonomy, not the metric, tells you what to build.
3. Keep rejected experiments as first-class artifacts — the rejection record is what makes the accepted decisions credible.
4. Lexical reranking has a ceiling, and you can measure yourself hitting it.

Part 2: what happened when embeddings tried to break that ceiling — including two expensive-looking failures before the breakthrough.
