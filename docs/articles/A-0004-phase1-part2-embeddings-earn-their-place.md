# A-0004 — A Quarter of Search Engineering in Six Days, Part 2: When Embeddings Finally Earned Their Place

Status: draft ready for publishing handoff (target: feroshjacob.github.io)
Series: Phase 1 advances, part 2 of 2 (part 1: `A-0003`)
Source handoff: `.mde/handoffs/control-center-stream_mreep6je_ab6e2bd9-phase1-article-source.md`

Cross references:

- Mission: `M-0001`
- Search Evolution: `SE-0003`, `SE-0004`
- Architecture: `ARCH-0.3-candidate`, `ARCH-0.4-candidate`
- Decisions: `ADL-0003`, `ADL-0004`
- Git Commit: `73714a4` (latest) · Git Tag: not assigned (candidates are untagged by policy)
- Live system: https://retail-search.feroshjacob.workers.dev
- Milestone endpoint: `/api/milestones/arch-0.3-bge/search` (returns explicit 501 + evidence)
- Experiment artifacts: `experiments/cranfield-v0/`

---

## Draft

[Part 1](./A-0003-phase1-part1-lexical-ceiling.md) ended at a measured lexical ceiling: five ranking experiments lifted a Cranfield BM25 baseline from nDCG@10 0.2995 to **0.3260**, the final refinement was worth +0.2%, and 27 of 225 queries still retrieved nothing relevant in the top 10 because their vocabulary never overlaps their relevant documents. You cannot term-match your way out of a vocabulary mismatch.

This is the problem [embeddings](https://en.wikipedia.org/wiki/Sentence_embedding) exist to solve — representing meaning as vectors so "high-speed aircraft heating" can find documents about "thermal effects at supersonic velocities." Part 2 is the story of making that actually work on a production engine, which took three attempts, one instructive detour into learning-to-rank, and a lot of discipline about negative results.

The number to beat throughout: **refined PRF, nDCG@10 0.3260**.

### Attempt zero: controls before models

The agent's first move was *not* to grab a fancy model. It built the vector infrastructure — an embedding cache, a vector/hybrid evaluator, [k-nearest-neighbor](https://en.wikipedia.org/wiki/K-nearest_neighbors_algorithm) retrieval — and ran it with deterministic **hash vectors**: embeddings with no semantics at all, as a control group.

Result: vector-only nDCG@10 **0.1453**; best hybrid with BM25, 0.3054. Both well below PRF, exactly as they should be. The harness worked; any future gain would have to come from the model, not the plumbing. Cheap controls first is a habit worth stealing.

### Attempt one: chat-model embeddings fail, loudly

Next, real embeddings from a real LLM — a local Ollama `llama3.1:8b`, producing 4,096-dimensional vectors from each document's title and abstract.

Result: vector-only nDCG@10 **0.0282**.

Not a typo. An 8-billion-parameter language model's embeddings performed *five times worse than random hash vectors* at retrieval. The lesson is fundamental: embedding quality is a property of the training objective, not model size. Chat models are trained to generate text; their internal representations are not organized so that "query near relevant document" holds under cosine distance. Retrieval encoders are trained for exactly that. "Semantic search" is not one thing.

Blending the Ollama vectors with BM25 clawed back to 0.3035 — still below PRF. Rejected, with all artifacts kept public. This negative result is what makes the eventual win believable.

### The detour: is this a ranking problem or a recall problem?

Before paying for better embeddings, the agent quantified the headroom with an oracle analysis: if a perfect re-ranker reordered the existing top-50 candidate pools, how good could results get?

Answer: **oracle nDCG@10 of 0.7033** — against an achieved 0.3260. Coverage was high (96% of queries had at least one relevant document in the pool), though pool recall (0.6042) capped the ceiling. Conclusion: enormous reordering headroom. That justified trying [learning to rank](https://en.wikipedia.org/wiki/Learning_to_rank).

Two trainers were built: coordinate-ascent (via [coordinate descent](https://en.wikipedia.org/wiki/Coordinate_descent)) and dependency-free [gradient-boosted](https://en.wikipedia.org/wiki/Gradient_boosting) regression trees, both evaluated with query-grouped [5-fold cross-validation](https://en.wikipedia.org/wiki/Cross-validation_(statistics)) — essential on a 225-query dataset where [overfitting](https://en.wikipedia.org/wiki/Overfitting) is the default outcome.

With lexical and Ollama-embedding features: coordinate ascent reached CV nDCG@10 **0.3166**, boosted trees **0.3216**. Both below PRF. In-sample numbers looked much better (up to 0.3564) — and were recorded strictly as capacity evidence, because a model that memorizes 225 queries is worthless. The honest conclusion at this point: the ranking machinery works, but the features carry no signal the lexical ladder didn't already have.

### The breakthrough: a retrieval-tuned encoder

Attempt three used a model built for the job: **BAAI/bge-base-en-v1.5**, a 768-dimensional retrieval encoder run through a local SentenceTransformers bridge, with the model's retrieval query prefix and title+abstract document text.

Everything changed at once:

| Approach | nDCG@10 | vs PRF (0.3260) |
| --- | ---: | --- |
| BGE vector-only | 0.3419 | **+4.9%** |
| BGE hybrid (BM25 + dense) | 0.3533 | **+8.4%** |
| LTR boosted trees + BGE features (CV) | 0.3603 | **+10.5%** |

Three observations worth an article on their own:

1. **The 768-dimensional retrieval encoder beat the 4,096-dimensional chat model by 12× on vector-only retrieval** (0.3419 vs 0.0282). Dimensions and parameters are not the story; the training objective is.
2. **Hybrid beats pure-vector everywhere.** BM25 and dense retrieval fail on different queries; fusing them added another +0.011 over BGE alone.
3. **The LTR that failed suddenly worked.** The identical boosted-tree trainer that lost to PRF with lexical features became the best result of the phase once BGE similarities entered the feature set. LTR is only as good as its features.

### Making it production-shaped

An offline win in an evaluation harness is a notebook result, not an architecture. So the embeddings were loaded into a separate remote **OpenSearch kNN index** (768-dim vector field, [HNSW](https://en.wikipedia.org/wiki/Hierarchical_navigable_small_world)-backed [approximate nearest neighbor](https://en.wikipedia.org/wiki/Nearest_neighbor_search) search) — leaving the public index untouched — and the full 225-query evaluation was re-run live against the real engine.

The remote hybrid reproduced the offline number exactly: **nDCG@10 0.3533**, with the paper-comparable binary nDCG@20 coming in at **0.4926** — slightly above offline, and the first configuration in the project to beat the reference paper's BM25 (0.4714). The neural rerankers from that paper (0.5525–0.5670) remain ahead, which is the honest gap to chase next.

When the offline and live numbers agree to four decimal places, you can start calling it a candidate architecture.

### Shipping honesty: the 501 milestone

Here is an unusual production decision. The public site exposes every architecture milestone as a stable endpoint — baseline, PRF, and BGE. But live BGE search needs query vectors computed at request time, and the Cloudflare Worker has no embedding runtime yet. The usual demo move is to fake it.

Instead, `/api/milestones/arch-0.3-bge/search` returns an explicit **501 `milestone_runtime_not_enabled`** with the validated evidence artifacts, the remote index name, and the stated next implementation step — and the [explain page](https://retail-search.feroshjacob.workers.dev/phases/cranfield/explain) renders it as an honest status card next to the two live milestones, alongside archived query-level demo evidence. A 501 with evidence is a better public artifact than a demo that pretends to do live inference.

The BGE hybrid also remains — deliberately — *not* the public default. The same gate that held back every lexical candidate holds here: no promotion without transferability evidence on a second dataset (Phase 2, [BEIR](https://github.com/beir-cellar/beir)), plus a latency/cost policy and the runtime query-vector work.

### The full picture

Phase 1 in one table — sixteen experiments, four explicit rejections, six days:

| Milestone | nDCG@10 | vs baseline |
| --- | ---: | ---: |
| ARCH-0.1 BM25 baseline (released) | 0.2995 | — |
| Lexical ceiling: refined PRF (candidate) | 0.3260 | +8.8% |
| ARCH-0.3 BGE hybrid, live on OpenSearch kNN (candidate) | 0.3533 | +18.0% |
| BGE-feature LTR, cross-validated (candidate-adjacent) | 0.3603 | +20.3% |

Along the way: query-rescue (regressed), PRF-expanded retrieval (regressed), hash-vector control (as expected), chat-model embeddings (catastrophic), lexical-feature LTR (below PRF twice) — all preserved as public artifacts, because the rejections are what give the accepted numbers their meaning.

**Takeaways:**

1. Run cheap controls before paying for real models — and publish the negative results; they are what make the win believable.
2. "Semantic search" is not one thing: the gap between a chat LLM's embeddings and a retrieval-tuned encoder was the entire difference between failure and breakthrough.
3. Validate vector wins on the production engine, not just offline — and be suspicious until the numbers agree.
4. Ship honesty: an explicit 501 with evidence beats a faked demo, and a promotion gate you actually enforce beats a leaderboard.

Next mission: Phase 2 — BEIR transferability, where every candidate that won on Cranfield has to prove it wasn't just memorizing aeronautics.
