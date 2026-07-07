# SE-0001 - Cranfield OpenSearch BM25 Baseline

## Mission

`M-0001`

## Phase

Phase 1 - Cranfield Foundation

## Dataset

Cranfield Aeronautics Collection.

## Architecture Version

`ARCH-0.1`

## Architecture Decision

`ADL-0001`

## Article

`A-0002`

## Git

- Intended tag: `v0.1.0`
- Commit: pending

## Endpoints

- Search: `/api/v0.1/search`
- Explain: `/api/v0.1/explain`
- Latest search alias: `/api/search`
- Latest explain alias: `/api/explain`

## Baseline Metrics

Source: `experiments/cranfield-v0/evaluation-live.json`

| Metric | Value |
| --- | ---: |
| MAP | `0.2402` |
| nDCG@10 | `0.2995` |
| Precision@10 | `0.2316` |
| Recall@10 | `0.3994` |
| MRR | `0.5350` |

## Latency

Point API latencies are recorded in validation evidence and public endpoint responses. p95 latency remains pending.

## Memory, Index Size, Index Time

Pending. These must be captured before making public operational claims beyond the current Phase 1 baseline.

## Decision

Accepted as the baseline every later search-agent improvement must beat.

## Rollback History

None.

## Lessons Learned

- Cranfield exposes hard lexical BM25 failures even when top results look plausible.
- The next experiment should let agents inspect failures and propose OpenSearch-native changes first.
