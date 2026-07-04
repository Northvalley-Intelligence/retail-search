# ADL-001 - Cranfield OpenSearch Baseline

## Mission

Phase 1 establishes a working Cranfield search baseline using OpenSearch before adding query understanding, semantic search, learning-to-rank, personalization, or behavioral signals.

## Observed Problem

The project needs a production-shaped starting point that can be measured and explained. Adding advanced components before a baseline would make later improvements hard to attribute.

## Decision

Use OpenSearch BM25 as the v0 Cranfield retrieval and ranking baseline.

## Implementation Summary

- Index Cranfield-shaped documents with an English analyzer.
- Search with `multi_match` over `title^3`, `abstract^2`, and `text`.
- Filter to the Cranfield dataset.
- Expose search and explain endpoints through a Cloudflare Worker-compatible module.
- Report generated OpenSearch query, ranking logic, accepted decisions, and latency metadata in explain responses.

## Metrics Before And After

No previous implementation exists. GEN-001 includes a fixture evaluation artifact to validate metric calculation and output shape. Live Cranfield metrics remain pending until an OpenSearch corpus is available.

## Latency Impact

The endpoint records API elapsed time and OpenSearch `took` time. Public latency measurements remain pending deployment.

## Indexing Impact

Introduces one OpenSearch index, `cranfield-v0`, with strict mappings for id, dataset, title, abstract, text, source, and indexed timestamp.

## Transferability Result

Not applicable yet. Transferability is a Phase 2 BEIR gate.

## Status

Accepted as the Phase 1 baseline architecture.

