import { ValidationError } from "../errors.js";
import { TRACEABILITY } from "../traceability.js";

export const DATASET_ID = "cranfield";
export const DEFAULT_INDEX = "cranfield-v0";
export const ARCHITECTURE_VERSION = "v0-cranfield-opensearch-baseline";
export const SEARCH_FIELDS = ["title^3", "abstract^2", "text"];

export const DATASET_PROFILE = {
  id: DATASET_ID,
  name: "Cranfield Aeronautics Collection",
  index: DEFAULT_INDEX,
  source: {
    name: "Glasgow Cranfield test collection",
    irDatasetsId: "cranfield",
    url: "https://ir.dcs.gla.ac.uk/resources/test_collections/cran/",
    archiveUrl: "http://ir.dcs.gla.ac.uk/resources/test_collections/cran/cran.tar.gz"
  },
  traceability: {
    missionId: TRACEABILITY.missionId,
    searchEvolutionId: TRACEABILITY.searchEvolutionId,
    architectureVersion: TRACEABILITY.architectureVersion,
    architectureSlug: TRACEABILITY.architectureSlug,
    architectureDecisionIds: TRACEABILITY.architectureDecisionIds,
    gitTag: TRACEABILITY.gitTag,
    endpointVersion: TRACEABILITY.endpointVersion
  },
  documentCount: 1400,
  evaluationQueryCount: 225,
  relevanceJudgmentCount: 1837,
  contentType: "Technical aeronautics abstracts and reports",
  description:
    "The indexed documents are short aerospace research records from the Cranfield collection. Good searches are technical phrases about aerodynamics, aircraft structures, pressure, flow, heat transfer, boundary layers, airfoils, wings, drag, lift, stability, and wind tunnel measurements.",
  indexedFields: [
    {
      name: "title",
      searchWeight: "3x",
      role: "Highest-weight field for concise paper titles."
    },
    {
      name: "abstract",
      searchWeight: "2x",
      role: "Medium-weight field for report summaries."
    },
    {
      name: "text",
      searchWeight: "1x",
      role: "Full searchable text assembled from the Cranfield record."
    },
    {
      name: "dataset",
      searchWeight: "filter",
      role: "Keeps Phase 1 results scoped to Cranfield."
    },
    {
      name: "source",
      searchWeight: "metadata",
      role: "Identifies the public corpus source."
    }
  ],
  exampleQueries: [
    "wing pressure distribution",
    "boundary layer transition",
    "hypersonic heat transfer",
    "airfoil drag coefficient",
    "wind tunnel turbulence",
    "supersonic flow over cones"
  ],
  topicHints: [
    "wings",
    "airfoils",
    "boundary layers",
    "pressure distribution",
    "heat transfer",
    "supersonic flow",
    "wind tunnels",
    "lift and drag",
    "stability",
    "aeroelasticity"
  ]
};

export const RANKING_LOGIC = [
  "OpenSearch BM25 baseline over title, abstract, and text fields.",
  "Title receives the highest field boost, abstract receives a moderate boost, and full text is unboosted.",
  "No query-specific result overrides, runtime LLM calls, personalization, or learning-to-rank model are used in v0."
];

export const RETRIEVAL_FLOW = [
  {
    id: "query",
    title: "Query",
    detail: "User submits a short technical search phrase."
  },
  {
    id: "normalize",
    title: "Normalize",
    detail: "Whitespace is trimmed and repeated spaces are collapsed."
  },
  {
    id: "build",
    title: "OpenSearch Query",
    detail: "A multi_match request targets title, abstract, and text."
  },
  {
    id: "retrieve",
    title: "Retrieve",
    detail: "OpenSearch searches the live cranfield-v0 index."
  },
  {
    id: "rank",
    title: "Rank",
    detail: "BM25 scores documents with title and abstract boosts."
  },
  {
    id: "explain",
    title: "Explain",
    detail: "The response includes the generated query, decisions, latency, and top-result rationale."
  }
];

export const ACCEPTED_ARCHITECTURE_DECISIONS = [
  {
    id: "ADL-0001",
    legacyIds: ["ADL-001"],
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
