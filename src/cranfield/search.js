import { executeOpenSearchSearch, getOpenSearchIndex } from "../opensearch.js";
import { traceabilityPayload } from "../traceability.js";
import {
  ARCHITECTURE_VERSION,
  DATASET_ID,
  DEFAULT_INDEX,
  RANKING_LOGIC,
  SEARCH_FIELDS,
  assertNonEmptyQuery,
  normalizeQuery,
  parseResultSize
} from "./schema.js";

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function buildCranfieldSearchBody(query, options = {}) {
  const normalized = normalizeQuery(query);
  assertNonEmptyQuery(normalized.normalized);

  const size = parseResultSize(options.size, 10);
  return {
    size,
    track_total_hits: true,
    _source: ["id", "dataset", "title", "abstract", "text", "source"],
    query: {
      bool: {
        filter: [
          {
            term: {
              dataset: DATASET_ID
            }
          }
        ],
        must: [
          {
            multi_match: {
              query: normalized.normalized,
              fields: SEARCH_FIELDS,
              type: "best_fields",
              operator: "or"
            }
          }
        ]
      }
    }
  };
}

function mapHit(hit) {
  const source = hit._source || {};
  return {
    id: source.id || hit._id,
    score: hit._score ?? null,
    title: source.title || "",
    abstract: source.abstract || "",
    source: source.source || DATASET_ID
  };
}

function getTotalHits(payload) {
  const total = payload?.hits?.total;
  if (typeof total === "number") {
    return total;
  }
  if (total && typeof total.value === "number") {
    return total.value;
  }
  return Array.isArray(payload?.hits?.hits) ? payload.hits.hits.length : 0;
}

export async function searchCranfield({
  query,
  size = 10,
  env = {},
  fetchImpl,
  includeOpenSearchQuery = false
}) {
  const startedAt = nowMs();
  const normalized = normalizeQuery(query);
  assertNonEmptyQuery(normalized.normalized);

  const index = getOpenSearchIndex(env, DEFAULT_INDEX);
  const openSearchQuery = buildCranfieldSearchBody(normalized.normalized, { size });
  const payload = await executeOpenSearchSearch({
    env,
    index,
    body: openSearchQuery,
    fetchImpl
  });

  const latencyMs = Math.round((nowMs() - startedAt) * 100) / 100;
  const results = (payload?.hits?.hits || []).map(mapHit);

  const response = {
    query: normalized.normalized,
    incomingQuery: normalized.incoming,
    dataset: DATASET_ID,
    architectureVersion: env.ARCHITECTURE_VERSION || ARCHITECTURE_VERSION,
    traceability: traceabilityPayload(env),
    index,
    ranking: RANKING_LOGIC,
    resultCount: results.length,
    totalHits: getTotalHits(payload),
    results,
    latency: {
      apiMs: latencyMs,
      openSearchTookMs: payload?.took ?? null
    }
  };

  if (includeOpenSearchQuery) {
    response.openSearchQuery = openSearchQuery;
  }

  return response;
}
