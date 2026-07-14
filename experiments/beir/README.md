# BEIR Experiment Artifacts

Phase 2 (M-0002) evaluation artifacts, one directory per BEIR dataset. Corpora are
fetched locally with `npm run fetch:beir -- --dataset beir/<name>` and never committed;
only evaluation result artifacts live here.

## Artifacts

- `scifact/evaluation-bm25-gen027.json` — live BM25 baseline, 300 test queries, nDCG@10 0.6906 vs published 0.665 (+3.9% relative).
- `nfcorpus/evaluation-bm25-gen027.json` — live BM25 baseline, 323 test queries, nDCG@10 0.3273 vs published 0.325 (+0.7% relative).

Cranfield shared-harness parity artifacts for the same generation live in
`../cranfield-v0/evaluation-shared-harness-baseline-gen027.json` (nDCG@10 0.2995, exact
Phase 1 parity) and `../cranfield-v0/evaluation-shared-harness-prf-rerank-gen027.json`
(nDCG@10 0.3260, exact refined-PRF parity).

Every evaluation artifact embeds a `referenceComparison` block with the published BM25
reference number and the measured delta, per the Mission Update 002 sanity policy:
baselines landing far from published values indicate a harness bug, not a discovery.
