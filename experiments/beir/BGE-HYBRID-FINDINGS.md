# BGE Hybrid Cross-Domain Findings (GEN-029, M-0002.3)

## Result: BGE hybrid is the first Universal technique

BAAI/bge-base-en-v1.5 dense embeddings, hybrid with BM25 (min-max linear blend,
full-corpus vector recall), evaluated offline across the Cranfield + Tier-1 superset.

| Dataset | BM25 | BGE hybrid | Gain | Best variant |
|---|---|---|---|---|
| Cranfield | 0.3022 | 0.3533 | +16.9% | remote-hybrid (GEN-023) |
| SciFact | 0.6906 | 0.7565 | +9.5% | linear-0.8 |
| NFCorpus | 0.3273 | 0.3818 | +16.7% | linear-0.6 |
| FiQA | 0.2536 | 0.4158 | +64.0% | linear-0.8 |
| ArguAna | 0.4739 | 0.6432 | +35.7% | linear-0.9 |
| SCIDOCS | 0.1647 | 0.2217 | +34.6% | linear-0.7 |

**Improves 6/6, zero regressions => Universal (joins ARCH-0.5 core).**
Vector-only reproduced published BGE-base numbers on every dataset (harness check):
NFCorpus 0.374, SciFact 0.740, FiQA 0.406, ArguAna 0.640.

## Contrast with Phase 1 lexical techniques (both domain-conditional)

The BGE gains are largest exactly where the lexical rerankers failed: FiQA (+64% vs
PRF -3.3%), ArguAna (+35.7% vs PRF -6.8%), SCIDOCS (+34.6% vs flat). This confirms the
Phase 2 thesis: the Phase 1 keyword-reranking wins were partly Cranfield-shaped
(scientific-corpus), while dense retrieval transfers across domains.

## Scope caveat

"Universal" here spans Cranfield + Tier 1 (the small corpora where a live/offline kNN
over the full corpus is tractable). Tier 2-3 dense evaluation remains offline/subsampled
per the free-tier infra limits; the classification is re-tested as those land. The signal
(6/6, zero regressions, large margins) is strong and consistent.

## Method notes

- Query prefix: "Represent this sentence for searching relevant passages: " (BGE retrieval).
- Self-hit exclusion applied on both lexical and vector sides for ArguAna/Quora.
- FiQA (57K docs, 946MB embeddings) exceeded Node's string limit for JSON.parse; evaluated
  with an equivalent numpy evaluator, cross-validated against the JS evaluator to within
  0.001 nDCG on NFCorpus and ArguAna.

## LTR column (GEN-029 cont.): strong technique, but Occam keeps hybrid as core

Boosted-tree LTR with BGE + lexical features, query-grouped cross-validation, over the
BM25 pool. LTR improves over BM25 everywhere (a capable ranker), and on some datasets
even beats plain BGE hybrid:

| Dataset | BM25 | LTR (CV) | vs BGE hybrid | Verdict |
|---|---|---|---|---|
| Cranfield | 0.3022 | 0.3603 (+19.2%) | 0.3533 | LTR wins |
| ArguAna | 0.4739 | 0.6708 (+41.5%) | 0.6432 | LTR wins |
| SciFact | 0.6906 | 0.7510 (+8.8%) | 0.7565 | hybrid wins |
| NFCorpus | 0.3273 | 0.3568 (+9.0%) | 0.3818 | hybrid wins |

**LTR beats plain BGE hybrid on 2/4 (50%) < the 70% universal bar => BGE hybrid stays the
ARCH-0.5 core (Occam rule: the simpler technique runs live). LTR is a portfolio technique**
- activatable where it helps (Cranfield-like scientific, argument retrieval), infrastructure
kept for Phase 4 behavioral features which will likely need a learned ranker.

Notes: fiqa LTR deferred (946MB embeddings exceed Node's JSON.parse limit; needs the numpy
path). scidocs LTR attempted but pathologically slow in pure-JS boosted-tree CV; not run.
The 2/4 split is decisive for the Occam call regardless of those two. Light CV settings
(3 folds, 30 trees) were validated to preserve the LTR-vs-hybrid direction (nfcorpus full
0.3568 vs light 0.3584).
