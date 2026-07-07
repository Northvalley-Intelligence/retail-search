export const TRACEABILITY = {
  missionId: "M-0001",
  articleIds: ["A-0002"],
  searchEvolutionId: "SE-0001",
  architectureVersion: "ARCH-0.1",
  architectureSlug: "v0-cranfield-opensearch-baseline",
  architectureDecisionIds: ["ADL-0001"],
  legacyArchitectureDecisionIds: ["ADL-001"],
  gitTag: "v0.1.0",
  gitVersionFallback: "working-tree",
  endpointVersion: "v0.1",
  datasetId: "cranfield"
};

export function traceabilityPayload(env = {}) {
  return {
    missionId: TRACEABILITY.missionId,
    articleIds: TRACEABILITY.articleIds,
    searchEvolutionId: TRACEABILITY.searchEvolutionId,
    architectureVersion: TRACEABILITY.architectureVersion,
    architectureSlug: env.ARCHITECTURE_VERSION || TRACEABILITY.architectureSlug,
    architectureDecisionIds: TRACEABILITY.architectureDecisionIds,
    gitTag: TRACEABILITY.gitTag,
    gitVersion: env.GIT_VERSION || TRACEABILITY.gitVersionFallback,
    endpointVersion: TRACEABILITY.endpointVersion,
    datasetId: TRACEABILITY.datasetId
  };
}
