# BEIR Baseline Findings (GEN-028, M-0002.2)

## BM25 baseline sweep: 15 public BEIR datasets

All public BEIR datasets baselined with the dataset-agnostic harness (BM25
`multi_match` best_fields over title+text, tie_breaker 0.5, nDCG@10 with
pytrec_eval-style linear gain), evaluated live against a single free-tier
OpenSearch instance using the sequential index -> evaluate -> drop pattern.

**Aggregate: mean BM25 nDCG@10 = 0.4261, dead-on the published BEIR BM25 average
(~0.43).** 13 of 15 datasets reproduce within ±9% (10 within ±5%).

## Finding: FEVER-family localized discrepancy (accepted, not chased)

FEVER (0.6493 vs published 0.753, −13.8%) and Climate-FEVER (0.1862 vs 0.213,
−12.6%) are the only two datasets outside ±9%. They share the same 5.42M-doc
corpus. Diagnosis:

- **Not a general harness bug.** 13/15 datasets reproduce cleanly, including three
  other Wikipedia-based corpora (NQ −0.8%, HotpotQA −0.1%, DBPedia +2.4%), and the
  aggregate lands on the published average. The discrepancy is localized to the
  FEVER-family corpus.
- **Different failure shapes despite the shared corpus:** FEVER is 70%
  lexical_noise_low_precision (relevant docs retrieved but ranked noisily),
  Climate-FEVER is 54% zero_relevant_at_k (recall gap, compounded by that
  dataset's known qrels sparsity).
- **Likely cause:** OpenSearch default BM25 (k1=1.2, b=0.75) and the english
  analyzer differ from the Anserini configuration behind the published numbers
  (k1=0.9, b=0.4, plus title concatenation), and those differences bite hardest on
  this corpus's document-length and title-centrality characteristics.

**Decision (operator, 2026-07-15): document and proceed.** The harness is sound,
and the mission explicitly rejects optimizing BEIR scores for their own sake. The
baseline exists to measure *technique deltas*; a consistent-config BM25 baseline
yields valid deltas on FEVER/Climate-FEVER even at a ~13% absolute offset from
Anserini. Re-tuning BM25 per corpus to chase published parity is deferred as a
non-goal. Re-testable in any later phase if the picture changes.
