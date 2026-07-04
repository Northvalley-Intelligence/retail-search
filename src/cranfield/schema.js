import { ValidationError } from "../errors.js";

export const DATASET_ID = "cranfield";
export const DEFAULT_INDEX = "cranfield-v0";
export const ARCHITECTURE_VERSION = "v0-cranfield-opensearch-baseline";
export const SEARCH_FIELDS = ["title^3", "abstract^2", "text"];

export const RANKING_LOGIC = [
  "OpenSearch BM25 baseline over title, abstract, and text fields.",
  "Title receives the highest field boost, abstract receives a moderate boost, and full text is unboosted.",
  "No query-specific result overrides, runtime LLM calls, personalization, or learning-to-rank model are used in v0."
];

export const ACCEPTED_ARCHITECTURE_DECISIONS = [
  {
    id: "ADL-001",
    status: "accepted",
    summary: "Start Phase 1 with a transparent OpenSearch BM25 Cranfield baseline before adding query understanding or ranking layers."
  }
];

export const CRANFIELD_INDEX_BODY = {
  settings: {
    index: {
      number_of_shards: 1,
      number_of_replicas: 0
    },
    analysis: {
      analyzer: {
        cranfield_english: {
          type: "english"
        }
      }
    }
  },
  mappings: {
    dynamic: "strict",
    properties: {
      id: { type: "keyword" },
      dataset: { type: "keyword" },
      title: {
        type: "text",
        analyzer: "cranfield_english",
        fields: {
          keyword: { type: "keyword", ignore_above: 256 }
        }
      },
      abstract: {
        type: "text",
        analyzer: "cranfield_english"
      },
      text: {
        type: "text",
        analyzer: "cranfield_english"
      },
      source: { type: "keyword" },
      indexed_at: { type: "date" }
    }
  }
};

export function normalizeQuery(query) {
  const incoming = query == null ? "" : String(query);
  const trimmed = incoming.trim();
  const normalized = trimmed.replace(/\s+/g, " ");
  const transformations = [];

  if (incoming !== trimmed) {
    transformations.push("trimmed leading/trailing whitespace");
  }
  if (trimmed !== normalized) {
    transformations.push("collapsed repeated internal whitespace");
  }
  if (transformations.length === 0) {
    transformations.push("none");
  }

  return {
    incoming,
    normalized,
    transformations
  };
}

export function parseResultSize(value, defaultSize = 10) {
  if (value == null || value === "") {
    return defaultSize;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
    throw new ValidationError("size must be an integer between 1 and 50", "invalid_size");
  }
  return parsed;
}

export function assertNonEmptyQuery(normalizedQuery) {
  if (!normalizedQuery) {
    throw new ValidationError("q is required", "missing_query");
  }
}

