# Building The First Retail Search Baseline

## Mission

Start with a transparent OpenSearch Cranfield baseline and make every later improvement earn its place through evidence.

## Dataset

Cranfield is the Phase 1 foundation dataset. GEN-001 includes Cranfield-shaped sample records for local validation; full Cranfield ingestion is pending external data setup.

## Baseline

The baseline uses OpenSearch BM25 over title, abstract, and text fields. Title is boosted most heavily because short document titles often carry strong relevance signals.

## Current Evidence

The repository validates:

- Worker search and explain contracts
- generated OpenSearch query shape
- no runtime LLM dependency
- metric calculations for MAP, nDCG, Precision, Recall, and MRR
- MDE artifact parseability

## Endpoint Status

The endpoint implementation exists, but live public URLs are pending Cloudflare and OpenSearch configuration.

## Architecture Impact

ADL-001 accepts the OpenSearch BM25 Cranfield baseline as v0. No semantic, LTR, personalization, or behavior component has been accepted.

## Next Mission

Load the full Cranfield corpus into OpenSearch, deploy the Worker, run live evaluation, and publish the public endpoint URLs.

