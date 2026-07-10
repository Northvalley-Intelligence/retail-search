import {
  ACCEPTED_ARCHITECTURE_DECISIONS,
  ARCHITECTURE_VERSION,
  DATASET_ID,
  RANKING_LOGIC,
  RETRIEVAL_FLOW,
  normalizeQuery,
  DEFAULT_SEARCH_ARCHITECTURE_ID,
  resolveSearchArchitecture
} from "./schema.js";
import { searchCranfield } from "./search.js";
import { traceabilityPayload } from "../traceability.js";

function resultExplanation(searchArchitecture) {
  if (searchArchitecture.id === "prf-expand-rerank") {
    return "Retrieved by field-sum OpenSearch BM25, expanded with deterministic pseudo-relevance-feedback terms, then reranked as a merged candidate pool.";
  }
  if (searchArchitecture.id === "prf-rerank") {
    return "Retrieved by field-sum OpenSearch BM25, then reranked with deterministic pseudo-relevance-feedback title/abstract coverage.";
  }
  if (searchArchitecture.id === "coverage-rerank") {
    return "Retrieved by field-sum OpenSearch BM25, then reranked with a deterministic title/abstract query-term coverage bonus.";
  }
  return `Ranked by OpenSearch BM25 score from the generated ${searchArchitecture.id} query.`;
}

export async function explainCranfield({ query, size = 10, env = {}, fetchImpl, architecture = DEFAULT_SEARCH_ARCHITECTURE_ID }) {
  const normalized = normalizeQuery(query);
  const searchArchitecture = resolveSearchArchitecture(architecture);
  const searchResponse = await searchCranfield({
    query,
    size,
    env,
    fetchImpl,
    includeOpenSearchQuery: true,
    architecture: searchArchitecture.id
  });

  return {
    incomingQuery: normalized.incoming,
    normalizedQuery: normalized.normalized,
    dataset: DATASET_ID,
    architectureVersion: env.ARCHITECTURE_VERSION || ARCHITECTURE_VERSION,
    traceability: traceabilityPayload(env),
    searchArchitecture,
    queryTransformations: normalized.transformations,
    openSearch: {
      index: searchResponse.index,
      query: searchResponse.openSearchQuery,
      expandedQuery: searchResponse.expandedOpenSearchQuery
    },
    reranking: searchResponse.reranking,
    retrievalFlow: RETRIEVAL_FLOW,
    retrievalStrategy: searchArchitecture.queryStrategy || "OpenSearch multi_match over Cranfield title, abstract, and text fields.",
    rankingLogic: searchArchitecture.rankingLogic || RANKING_LOGIC,
    acceptedArchitectureDecisions: ACCEPTED_ARCHITECTURE_DECISIONS,
    techniquesApplied: searchArchitecture.techniquesApplied,
    topResults: searchResponse.results.map((result, position) => ({
      rank: position + 1,
      id: result.id,
      score: result.score,
      rerankScore: result.rerankScore,
      originalRank: result.originalRank,
      title: result.title,
      explanation: resultExplanation(searchArchitecture)
    })),
    latency: searchResponse.latency
  };
}
