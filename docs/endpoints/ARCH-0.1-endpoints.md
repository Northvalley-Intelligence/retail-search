# ARCH-0.1 Endpoints

## Canonical Versioned API

- Search: `/api/v0.1/search`
- Explain: `/api/v0.1/explain`

## Legacy Version Alias

- Search: `/api/v0/search`
- Explain: `/api/v0/explain`

## Latest Alias

- Search: `/api/search`
- Explain: `/api/explain`

## Milestone Aliases

Comparison endpoints for `ARCH-0.1`, `ARCH-0.2-candidate`, and `ARCH-0.3-candidate` are documented in [Milestone endpoints](milestone-endpoints.md).

## Dataset-Specific API

- Search: `/api/cranfield/search`
- Explain: `/api/cranfield/explain`
- Metadata: `/api/cranfield/meta`
- Evaluation: `/api/cranfield/evaluation`

## Traceability Payload

Every local API response for `ARCH-0.1` reports:

- `missionId`: `M-0001`
- `searchEvolutionId`: `SE-0001`
- `architectureVersion`: `ARCH-0.1`
- `architectureDecisionIds`: `ADL-0001`
- `gitTag`: `v0.1.0`
- `endpointVersion`: `v0.1`

Deployment of the new `/api/v0.1/*` routes requires an explicit deploy action.
