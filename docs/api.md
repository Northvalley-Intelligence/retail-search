# API

## Search

```text
GET /api/cranfield/search?q=wing%20pressure&size=10
GET /api/v0/search?q=wing%20pressure
GET /api/search?q=wing%20pressure
```

The search endpoint requires `OPENSEARCH_URL` and either OpenSearch basic credentials or an API key. It sends a generated OpenSearch `multi_match` query to the configured Cranfield index.

Response fields include:

- incoming and normalized query
- dataset
- architecture version
- index
- ranking summary
- result count and total hits
- top results
- API and OpenSearch latency

## Explain

```text
GET /api/cranfield/explain?q=wing%20pressure&size=10
GET /api/v0/explain?q=wing%20pressure
GET /api/explain?q=wing%20pressure
```

The explain endpoint includes the generated OpenSearch query, query transformations, retrieval strategy, ranking logic, accepted architecture decisions, applied techniques, result explanations, and latency metadata.

## Runtime Rule

The live search path does not call an LLM. Offline agents may still be used later for indexing, enrichment, synonym discovery, query analysis, clustering, or evaluation when a future mission justifies that work.

