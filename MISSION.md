# Mission: Retail Search

# Mission: Self-Learning Agent-Based Search Engineering

## Vision

Build a production-quality search platform that is continuously improved by AI agents using Mission-Driven Engineering.

This project is not about building a toy academic search engine. It is about engineering a better search system on top of a real production-grade search engine.

The base execution engine must be OpenSearch unless a later mission proves that another production-grade search engine is better justified.

The project will start simple, expose public search endpoints, publish the code, document every experiment, and let the architecture evolve through evidence.

---

## Core Idea

Architecture is not the starting point.

Architecture is the result of validated missions.

The project begins with:

```text
Dataset
  ↓
OpenSearch
  ↓
Cloudflare Worker Search API
  ↓
Evaluation Framework
```

No query understanding, LTR, semantic search, personalization, or business ranking is assumed upfront.

Those components must earn their place through measurable improvements.

---

## Production-First Principle

Use standard tools wherever possible.

The implementation should assume:

* OpenSearch as the primary search engine
* Cloudflare Workers for the public API layer
* Cloudflare free-plan constraints where possible
* Public GitHub repository
* Public search endpoints
* Public search-explain endpoints
* Versioned experiment artifacts

The goal is to make readers feel that this could become a real retail search system, not just another benchmark project.

---

## Public Endpoints

Each major phase must expose working endpoints.

Examples:

```text
/api/cranfield/search?q=...
/api/cranfield/explain?q=...

/api/beir/search?q=...
/api/beir/explain?q=...

/api/esci/search?q=...
/api/esci/explain?q=...

/api/behavior/search?q=...
/api/behavior/explain?q=...
```

The latest endpoint may point to the best current system:

```text
/api/search?q=...
/api/explain?q=...
```

Versioned endpoints should remain available when practical:

```text
/api/v0/search?q=...
/api/v1/search?q=...
/api/v2/search?q=...
```

This allows readers to compare how the system improves over time.

---

## Search Explain Requirement

Every phase must include a search-explain endpoint.

The explain endpoint should describe:

* incoming query
* dataset searched
* active architecture version
* query transformations applied
* OpenSearch query generated
* retrieval strategy used
* ranking logic used
* accepted architecture decisions involved
* techniques applied
* top results with explanation
* latency and execution metadata

The purpose is to make the system transparent and educational.

Readers should be able to see not only what results were returned, but why they were returned.

---

## Architecture Decision Ledger

Every accepted architecture change must be recorded.

Each decision should include:

* mission
* observed problem
* evidence
* technique attempted
* implementation summary
* metrics before and after
* latency impact
* indexing impact
* transferability result
* decision status

Example:

```text
ADL-004

Problem:
Vocabulary mismatch caused many relevant results to be missed.

Decision:
Introduce synonym expansion in the query understanding layer.

Impact:
nDCG improved by 4.8%.
Average latency increased by 3 ms.

Status:
Accepted.
```

---

## Development Phases

## Phase 1 — Cranfield Foundation

Goal:

Build the smallest production-shaped search system using OpenSearch and Cranfield.

Deliverables:

* OpenSearch index for Cranfield
* Cloudflare Worker search API
* Cranfield search endpoint
* Cranfield explain endpoint
* baseline evaluation
* MAP, nDCG, Precision, Recall, MRR
* latency measurements
* first architecture version
* GitHub repository
* article linked to commit and endpoint

Purpose:

Establish a working baseline.

---

## Phase 2 — Transferability with BEIR

Goal:

Prevent Cranfield-specific overfitting.

Deliverables:

* BEIR-compatible indexing pipeline
* BEIR search endpoint
* BEIR explain endpoint
* evaluation comparison against Cranfield
* transferability gate
* accepted/rejected technique report

Purpose:

A technique is not accepted simply because it improves Cranfield. It must show evidence of transferability.

---

## Phase 3 — Retail Relevance with Amazon ESCI

Goal:

Move from academic document search to real retail product search.

Deliverables:

* Amazon ESCI indexing pipeline
* ESCI search endpoint
* ESCI explain endpoint
* product-aware mappings
* support for fields such as title, brand, description, color, bullets, and attributes
* evaluation using ESCI labels
* architecture updates if needed

Focus areas:

* product attributes
* brands
* colors
* substitutes
* complements
* product title matching
* field weighting
* retail-style relevance

Purpose:

Test whether the architecture discovered from academic datasets still works for retail search.

---

## Phase 4 — Behavioral Retail Search

Goal:

Introduce customer behavior as a ranking signal.

Possible datasets:

* Retail Rocket
* Coveo
* OTTO
* another public behavior dataset

Deliverables:

* behavioral dataset endpoint
* behavioral search explain endpoint
* behavior-aware ranking experiment
* CTR, purchase, add-to-cart, popularity, inventory, and freshness signals where available
* decision on whether LTR is justified
* architecture decision report

Purpose:

Determine whether behavior signals justify adding a ranking layer, LTR model, or simpler ranking strategy.

---

## Runtime Constraints

The live search path must remain production-safe.

Rules:

* No LLM call during live search.
* LLMs may be used only offline for indexing, enrichment, synonym discovery, clustering, query analysis, or evaluation.
* Average search latency target: under 700 ms.
* p95 latency should be tracked.
* Indexing should complete within a reasonable batch window.
* The public API should be deployable through Cloudflare Workers.
* Free-plan limits should be respected where practical.
* External tools and hosted OpenSearch options should be chosen with cost and reproducibility in mind.

---

## Agent Responsibilities

Agents may:

* inspect benchmark failures
* group failed queries
* propose hypotheses
* implement techniques
* generate OpenSearch mappings
* tune analyzers
* create synonym candidates
* enrich documents offline
* create evaluation reports
* update the architecture ledger
* prepare article artifacts only when Ferosh explicitly asks (see Mission Update 003)

Agents may not:

* hardcode query-specific results
* optimize only for one benchmark
* introduce runtime LLM dependencies
* add architectural components without measurable evidence
* hide complexity from the explain endpoint

---

## Evaluation Gates

Every improvement must pass applicable gates.

### Relevance Gate

Measure:

* MAP
* nDCG
* Recall
* Precision
* MRR

### Performance Gate

Measure:

* average latency
* p95 latency
* index size
* memory use
* indexing time

### Transferability Gate

Validate on at least one additional dataset when applicable.

### Architecture Gate

Ask:

* Did this require a new component?
* Could OpenSearch handle it directly?
* Is the added complexity justified?
* Would this make sense for a real retail site?

---

## Article Series Requirement

> Amended by Mission Update 003 (2026-07-14): articles are authored by Ferosh personally, and only after a phase implementation is complete and validated. Agents and planners must never initiate or draft article work, or post content anywhere, unless Ferosh explicitly asks. This section remains as the content template for those articles; agents keep the evidence ledgers article-ready.

Every article should map to one mission.

Each article should include:

* mission
* dataset
* baseline
* problem observed
* hypothesis
* implementation
* evaluation
* search endpoint
* explain endpoint
* architecture impact
* lessons learned
* next mission

Each article should link to:

* GitHub commit
* experiment folder
* live endpoint
* architecture decision ledger entry

---

## Project Traceability And Versioning

Every meaningful artifact produced by the project must be uniquely identifiable and permanently traceable. A reader should be able to start from any artifact - an article, Git commit, search endpoint, architecture version, benchmark report, or experiment - and navigate the complete engineering history.

Nothing should become an isolated document.

### Identifier Standards

Stable identifiers:

* Missions: `M-0001`, `M-0002`, `M-0003`
* Articles: `A-0001`, `A-0002`, `A-0003`
* Search Evolution entries: `SE-0001`, `SE-0002`, `SE-0003`
* Architecture versions: `ARCH-0.1`, `ARCH-0.2`, `ARCH-0.3`
* Architecture Decision Ledger entries: `ADL-0001`, `ADL-0002`, `ADL-0003`
* Git tags: semantic versions such as `v0.1.0`, `v0.2.0`, `v0.3.0`

Each release corresponds to one architecture version. Architecture versions are cumulative. Search Evolution entries are permanent even when an experiment is rejected, deferred, rolled back, or superseded.

### Cross-Reference Requirements

Each mission references:

* Article
* Search Evolution entry
* Architecture version
* Git tag

Each article references:

* Mission
* Search Evolution entry
* Architecture version
* Architecture Decision Ledger entry
* Git commit
* Search endpoint
* Search explain endpoint

Each Search Evolution entry references:

* Mission
* Dataset
* Architecture version
* Architecture Decision Ledger entry
* Git commit
* Article
* Benchmark report
* Search endpoint
* Search explain endpoint

Each Architecture Timeline entry references:

* Search Evolution entry
* Architecture Decision Ledger entry
* Mission
* Git tag

Each Architecture Decision Ledger entry references:

* Mission
* Search Evolution entry
* Architecture version
* Dataset
* Related article

### Public Endpoint Traceability

Every released architecture exposes versioned APIs:

```text
/api/search
/api/explain

/api/v0.1/search
/api/v0.1/explain

/api/v0.2/search
/api/v0.2/explain
```

Every endpoint reports:

* Architecture version
* Search Evolution entry
* Git version

The explain endpoint also reports:

* Query transformations
* OpenSearch query
* Active architectural components
* Architecture Decision Ledger entries involved
* Ranking strategy
* Latency
* Result explanation

### Current Phase 1 Traceability Chain

```text
Mission M-0001
  -> Article A-0002
  -> Search Evolution SE-0001
  -> Architecture ARCH-0.1
  -> Decision ADL-0001
  -> Git Tag v0.1.0
  -> Live Endpoint /api/v0.1/search
  -> Explain Endpoint /api/v0.1/explain
```

The project must function not only as a continuously improving search platform, but also as a traceable engineering knowledge base documenting how production search architecture evolves through evidence, experimentation, and Mission-Driven Engineering.

---

## Definition of Success

Success is not building the most complex search architecture.

Success is discovering the simplest production-shaped architecture that improves search quality across datasets while remaining fast, explainable, reproducible, and deployable.

The final project should provide:

* a public GitHub repository
* continuously improving search endpoints
* search-explain endpoints
* versioned experiment artifacts
* architecture decision history
* article series documenting the journey
* a credible demonstration of agent-driven search engineering on top of OpenSearch
