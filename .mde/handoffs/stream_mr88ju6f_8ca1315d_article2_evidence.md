# Article 2 Evidence Pack - Retail Search

Stream: `stream_mr88ju6f_8ca1315d`  
Plan: `plan_mr88ju6g_e971f133`  
Project: `retail-search`  
Prepared: 2026-07-05  
Scope: project-local evidence only; no `feroshjacob` site edits.

## Proposed Article

Title: **The Baseline Before the Agents: Measuring Out-of-Box OpenSearch on Cranfield**

Thesis: Before search agents are allowed to tune analyzers, expand queries, create synonyms, or add ranking layers, the project needs a transparent production-shaped baseline. Article 2 should show the current out-of-box OpenSearch Cranfield implementation, the live relevance numbers, and the concrete failure cases that justify the next article: agent-driven search improvement.

## Current Status

- Production URL: `https://retail-search.feroshjacob.workers.dev/`
- GitHub repo: `https://github.com/Northvalley-Intelligence/retail-search`
- Current phase: Phase 1 - Cranfield Foundation.
- Current deployed Worker version in project release evidence: `68e53192-0cad-4466-b238-f2ab35150d1f`.
- Current MDE state: `GEN-009`, `phase_1_public_baseline_live`, latest validation `VAL-019`, pass count `2`, no active blockers.

## Cranfield Context

Cranfield is a classic information retrieval test collection from the Glasgow Cranfield source:

- Source page: `https://ir.dcs.gla.ac.uk/resources/test_collections/cran/`
- Archive used by the project: `http://ir.dcs.gla.ac.uk/resources/test_collections/cran/cran.tar.gz`
- `ir_datasets` id recorded locally: `cranfield`
- Indexed documents: `1,400`
- Evaluation queries: `225`
- Relevance judgments: `1,837`

Why it was selected:

- It has documents, queries, and qrels, so relevance can be measured instead of guessed.
- It is small enough to load into a managed OpenSearch index and evaluate quickly.
- It is academic aeronautics, not retail, which is useful for Phase 1 because it isolates the search engine baseline before product-specific ranking concerns.
- It creates visible lexical failure cases where BM25 finds plausible word matches but misses judged-relevant documents.
- Its limitations are intentional: later BEIR and ESCI phases are needed before claiming retail-search relevance.

## Why OpenSearch

The project mission requires a production-grade search engine as the base execution engine. OpenSearch was selected because:

- It is a real deployable search engine, not a toy evaluator.
- It supports BM25, analyzers, mappings, filters, and field weighting out of the box.
- It can sit behind Cloudflare Workers as a public API layer.
- It gives a transparent baseline before adding query understanding, synonyms, semantic retrieval, LTR, personalization, or behavior signals.
- It matches ADL-001: start with OpenSearch BM25, then make every added component earn its place through evidence.

## Explicit Baseline Statement

This is the **out-of-box OpenSearch baseline** for the project. It is not search-agent tuned yet.

Current implementation uses:

- OpenSearch BM25.
- OpenSearch English analyzer.
- `multi_match` query over `title^3`, `abstract^2`, and `text`.
- A `dataset: cranfield` filter.
- Cloudflare Worker API endpoints.

Current implementation does **not** use:

- Search-agent-generated synonyms.
- Query expansion.
- Semantic embeddings.
- Learning to rank.
- Personalization.
- Behavioral signals.
- Runtime LLM calls.
- Query-specific hardcoded results.

This matters for the article: the current numbers are the baseline the agents must beat.

## Implementation Summary

Runtime path:

```text
Cranfield query
  -> Cloudflare Worker
  -> normalize whitespace only
  -> OpenSearch multi_match query
  -> cranfield-v0 index
  -> BM25 ranking
  -> JSON search/explain/evaluation response
```

Key public routes:

- Home: `https://retail-search.feroshjacob.workers.dev/`
- Phase 1 overview: `/phases/cranfield`
- Search UI: `/phases/cranfield/search`
- Indexed data: `/phases/cranfield/data`
- Explain flow: `/phases/cranfield/explain`
- Evaluation: `/phases/cranfield/evaluation`
- Search API: `/api/cranfield/search?q=...`
- Explain API: `/api/cranfield/explain?q=...`
- Evaluation API: `/api/cranfield/evaluation`
- Latest aliases: `/api/search`, `/api/explain`

Local implementation files:

- `src/cranfield/schema.js`: index profile, source metadata, search fields, ranking logic, retrieval flow.
- `src/cranfield/search.js`: builds and executes OpenSearch `multi_match` search.
- `src/cranfield/explain.js`: wraps search with generated query, ranking logic, retrieval flow, techniques, and latency metadata.
- `src/worker.js`: public API and page routing.
- `src/ui.js`: public home, Phase 1 pages, data references, search/explain/evaluation UI.
- `experiments/cranfield-v0/evaluation-live.json`: live evaluation artifact.

## Current Metrics

Source artifact: `experiments/cranfield-v0/evaluation-live.json`  
Artifact `generatedAt`: `2026-07-04T00:00:00.000Z`  
File timestamp observed locally: `Jul 4 20:23:09 2026`  
Evaluation run recorded in MDE: `GEN-003`, date `2026-07-04`  
Evaluation transport: `live-opensearch`  
Index: `cranfield-v0`  
Queries evaluated: `225`  
Top-k: `10`

Command recorded in `.mde/generations/GEN-003.json`:

```bash
npm run eval:cranfield -- --queries /private/tmp/retail-search-cranfield-live/queries.json --write experiments/cranfield-v0/evaluation-live.json --summary --concurrency 3
```

Metrics:

| Metric | Value |
| --- | ---: |
| MAP | `0.2402` |
| nDCG@10 | `0.2995` |
| Precision@10 | `0.2316` |
| Recall@10 | `0.3994` |
| MRR | `0.5350` |

Interpretation for the article:

- The baseline is real and measurable.
- It retrieves some good results, but many queries still fail hard.
- MAP and nDCG leave enough room to justify agent-led analysis and tuning.
- The next article should not claim agents are useful abstractly; it should use these failures to propose and test specific improvements.

## Broken Cranfield Queries For Article 3 Motivation

All examples below have `Precision@10 = 0`, `Recall@10 = 0`, `Average Precision = 0`, `MRR = 0`, and `nDCG@10 = 0` in `evaluation-live.json`.

Public API spot-check source: `https://retail-search.feroshjacob.workers.dev/api/search?size=3&q=...` on 2026-07-05.

| Query ID | Query | Top returned documents from current public API | Judged relevant documents from qrels | Why this motivates agents |
| --- | --- | --- | --- | --- |
| `13` | `what is the basic mechanism of the transonic aileron buzz .` | `496` - "a theory of transonic aileron buzz, neglecting viscous effects ."; `313` - "on alternative forms for the basic equations of transonic flow theory ."; `903` - "two dimensional transonic unsteady flow with shock waves ." | `65` grade 4; `311` grade 4; `64` grade 2; `265` grade 2 | Lexical match is excellent, but qrels judge the top obvious title match as non-relevant. Agents can analyze whether the query asks for mechanism/causality rather than title similarity. |
| `22` | `did anyone else discover that the turbulent skin friction is not over sensitive to the nature of the variation of the viscosity with temperature .` | `140` - "the determination of turbulent skin friction by means of pitot tubes ."; `125` - "measurements of skin friction of the compressible turbulent boundary layer on a cone with foreign gas injection ."; `413` - "turbulent skin friction at high mach numbers and reynolds numbers in air and helium . nasa r82, 1960 ." | `68` grade 1 | BM25 chases repeated surface terms like turbulent/skin/friction, while the judged answer is a broader simulation/hypersonic approximation document. |
| `28` | `what application has the linear theory design of curved wings .` | `681` - "integrals and integral equations in linearized wing theory ."; `251` - "a collection of longitudinal stability derivatives of wings at supersonic speeds ."; `1048` - "a small deflection theory for curved sandwich plates ." | `224` grade 3; `279` grade 3 | The current baseline returns generic linearized wing theory and curved plate matches, missing the judged application-oriented curved-wing documents. |
| `31` | `what size of end plate can be safely used to simulate two-dimensional flow conditions over a bluff cylindrical body of finite aspect ratio .` | `751` - "a note on the use of end plates to prevent three dimensional flow at the ends of bluff cylinders ."; `698` - "the unsteady lift of a wing of finite aspect ratio ."; `920` - "supersonic flow over an inclined wing of zero aspect ratio ." | `776` grade 4 | Top result sounds very close, but the judged relevant document is about force measurements on square and dodecagonal cylinders. This is a good example of evaluation disagreeing with naive title similarity. |
| `38` | `does transition in the hypersonic wake depend on body geometry and size` | `536` - "transition in the viscous wakes of blunt bodies at hypersonic speeds ."; `976` - "turbulent diffusion in the wake of a blunt nosed body at hypersonic speeds ."; `1238` - "the newtonian approximation in magnetic hypersonic stagnation-point flow ." | `557` grade 4; `558` grade 4; `272` grade 3; `24` grade 2; `283` grade 2 | Top results are semantically plausible but still miss every judged-relevant doc in top 10. Agents can cluster this as a query intent and vocabulary mismatch case. |

Use these as Article 3 setup:

- Agent task 1: inspect zero-score queries and classify failure modes.
- Agent task 2: propose OpenSearch-native interventions first, before adding model complexity.
- Agent task 3: test synonym/query expansion/analyzer changes against MAP, nDCG@10, Precision@10, Recall@10, MRR, and latency.
- Agent constraint: no runtime LLM calls in live search.

## Caveats And Missing Data

- The project has live public endpoints, but no GitHub commit hash was selected for the article handoff. The article drafter should link to the commit only after the working tree is committed.
- The deployed public URL is current, but the repository has many uncommitted project changes from Phase 1 work.
- Cranfield is not a retail dataset. It is a relevance-evaluation foundation; retail relevance starts with Amazon ESCI in a later phase.
- BEIR and ESCI pages are planned/reference pages only; they are not implemented search phases yet.
- Behavior data source is explicitly not selected.
- Evaluation is top-10 over 225 Cranfield queries, not a full latency benchmark.
- Point latency is available in public API responses, but p95 latency has not been calculated yet.
- The current implementation has basic field weighting and English analyzer configuration, but no agent-driven search tuning.
- Some Cranfield qrels can look counterintuitive to readers; article copy should explain that evaluation follows the benchmark judgments, not the author's eyeballing of titles.
- `docs/articles/phase-1-cranfield-baseline.md` is stale relative to deployment; it still says public endpoints are pending. Use current MDE/release evidence instead.

## Key Facts For Drafter

- Article should position this as the baseline before agents, not as the final search system.
- Main hook: "The first useful result of self-learning search engineering is not a clever model. It is a measurable baseline that exposes exactly where the system fails."
- Production URL to include: `https://retail-search.feroshjacob.workers.dev/`
- Repo URL to include: `https://github.com/Northvalley-Intelligence/retail-search`
- Dataset source to include: `https://ir.dcs.gla.ac.uk/resources/test_collections/cran/`
- Metrics line: "Live OpenSearch Cranfield baseline over 225 queries: MAP 0.2402, nDCG@10 0.2995, Precision@10 0.2316, Recall@10 0.3994, MRR 0.5350."
- Explicit baseline line: "No search-agent tuning has been applied yet; this is the out-of-box OpenSearch BM25 baseline with simple field weights."
- Next-article bridge: "Now that failures are measurable, agents can inspect broken queries, propose OpenSearch-native changes, and rerun the same evaluation gate."
