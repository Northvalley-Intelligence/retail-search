# Project Traceability And Versioning

Every meaningful Retail Search artifact receives a stable identifier and cross-links to the engineering evidence that created it.

## Identifier Standards

| Artifact | Format | Current Phase 1 ID |
| --- | --- | --- |
| Mission | `M-0001` | `M-0001` |
| Article | `A-0001` | `A-0002` |
| Search Evolution entry | `SE-0001` | `SE-0001` |
| Architecture version | `ARCH-0.1` | `ARCH-0.1` |
| Architecture decision | `ADL-0001` | `ADL-0001` |
| Git tag | semantic version | `v0.1.0` pending |

## Current Chain

```text
Mission M-0001
  -> Article A-0002
  -> Search Evolution SE-0001
  -> Architecture ARCH-0.1
  -> Decision ADL-0001
  -> Git Tag v0.1.0
  -> /api/v0.1/search
  -> /api/v0.1/explain
```

## Canonical Artifacts

- Mission: [M-0001 Cranfield Foundation](missions/M-0001-cranfield-foundation.md)
- Article handoff: [A-0002 Baseline Before Agents](articles/A-0002-baseline-before-agents.md)
- Search Evolution timeline: [timeline](evolution/timeline.md)
- Search Evolution entry: [SE-0001 Cranfield Baseline](evolution/experiments/SE-0001-cranfield-baseline.md)
- Architecture timeline: [timeline](architecture/timeline.md)
- Architecture version: [ARCH-0.1 Cranfield Baseline](architecture/versions/ARCH-0.1-cranfield-baseline.md)
- Decision: [ADL-0001 Cranfield OpenSearch Baseline](architecture/decisions/ADL-0001-cranfield-opensearch-baseline.md)
- Endpoints: [ARCH-0.1 endpoints](endpoints/ARCH-0.1-endpoints.md)

## Current Gaps

- `v0.1.0` is the intended Phase 1 tag, but the current working tree still needs commit and tag creation.
- The local implementation now supports `/api/v0.1/search` and `/api/v0.1/explain`; deployment of that endpoint change requires an explicit deploy action.
