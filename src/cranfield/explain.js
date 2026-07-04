import {
  ACCEPTED_ARCHITECTURE_DECISIONS,
  ARCHITECTURE_VERSION,
  DATASET_ID,
  RANKING_LOGIC,
  normalizeQuery
} from "./schema.js";
import { searchCranfield } from "./search.js";

export async function explainCranfield({ query, size = 10, env = {}, fetchImpl }) {
  const normalized = normalizeQuery(query);
  const searchResponse = await searchCranfield({
    query,
    size,
    env,
    fetchImpl,
    includeOpenSearchQuery: true
  });

  return {
    incomingQuery: normalized.incoming,
    normalizedQuery: normalized.normalized,
    dataset: DATASET_ID,
    architectureVersion: env.ARCHITECTURE_VERSION || ARCHITECTURE_VERSION,
    queryTransformations: normalized.transformations,
    openSearch: {
      index: searchResponse.index,
      query: searchResponse.openSearchQuery
    },
    retrievalStrategy: "OpenSearch multi_match over Cranfield title, abstract, and text fields.",
    rankingLogic: RANKING_LOGIC,
    acceptedArchitectureDecisions: ACCEPTED_ARCHITECTURE_DECISIONS,
    techniquesApplied: [
      "OpenSearch English analyzer",
      "BM25 baseline scoring",
      "field weighting for title and abstract",
      "dataset filter for Cranfield documents"
    ],
    topResults: searchResponse.results.map((result, position) => ({
      rank: position + 1,
      id: result.id,
      score: result.score,
      title: result.title,
      explanation: "Ranked by OpenSearch BM25 score from the generated baseline multi_match query."
    })),
    latency: searchResponse.latency
  };
}

