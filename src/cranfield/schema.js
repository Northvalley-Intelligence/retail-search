import { ValidationError } from "../errors.js";
import { TRACEABILITY } from "../traceability.js";

export const DATASET_ID = "cranfield";
export const DEFAULT_INDEX = "cranfield-v0";
export const ARCHITECTURE_VERSION = "v0-cranfield-opensearch-baseline";
export const SEARCH_FIELDS = ["title^3", "abstract^2", "text"];
export const QUERY_RESCUE_SEARCH_FIELDS = ["title^8", "abstract^5", "text^2"];
export const DEFAULT_SEARCH_ARCHITECTURE_ID = "baseline";

export const SEARCH_ARCHITECTURES = {
  baseline: {
    id: "baseline",
    label: "ARCH-0.1 OpenSearch BM25 baseline",
    status: "accepted",
    searchEvolutionId: "SE-0001",
    architectureVersion: TRACEABILITY.architectureVersion,
    architectureSlug: ARCHITECTURE_VERSION,
    architectureDecisionIds: ["ADL-0001"],
    queryStrategy: "Single OpenSearch multi_match best_fields query over title, abstract, and text.",
    rankingLogic: [
      "OpenSearch BM25 baseline over title, abstract, and text fields.",
      "Title receives the highest field boost, abstract receives a moderate boost, and full text is unboosted.",
      "No query-specific result overrides, runtime LLM calls, personalization, or learning-to-rank model are used in v0."
    ],
    techniquesApplied: [
      "OpenSearch English analyzer",
      "BM25 baseline scoring",
      "field weighting for title and abstract",
      "dataset filter for Cranfield documents"
    ]
  },
  "query-rescue": {
    id: "query-rescue",
    label: "SE-0002 query-rescue candidate",
    status: "candidate",
    searchEvolutionId: "SE-0002",
    architectureVersion: "ARCH-0.2-candidate",
    architectureSlug: "v0.2-candidate-cranfield-query-rescue",
    architectureDecisionIds: ["ADL-0002"],
    queryStrategy:
      "Baseline BM25 recall clause plus phrase/proximity and all-keyword boost clauses to rescue zero-relevant and late-relevant Cranfield queries.",
    rankingLogic: [
      "Keep the baseline best_fields OR multi_match clause as the recall floor.",
      "Boost close phrase matches across title, abstract, and text to reward coherent concepts.",
      "Boost cross-field matches where all analyzed query terms appear, improving rank for focused technical topics.",
      "No query-specific result overrides, runtime LLM calls, personalization, or learning-to-rank model are used in the candidate."
    ],
    techniquesApplied: [
      "OpenSearch English analyzer",
      "BM25 baseline recall clause",
      "phrase/proximity boost",
      "cross-field all-keyword boost",
      "dataset filter for Cranfield documents"
    ],
    targetedFailureGroups: ["zero_relevant_at_k", "late_first_relevant", "lexical_noise_low_precision"]
  },
  "field-sum": {
    id: "field-sum",
    label: "SE-0002 field-sum candidate",
    status: "candidate",
    searchEvolutionId: "SE-0002",
    architectureVersion: "ARCH-0.2-candidate",
    architectureSlug: "v0.2-candidate-cranfield-field-sum",
    architectureDecisionIds: ["ADL-0002"],
    queryStrategy:
      "Separate boosted BM25 match clauses for title, abstract, and text so evidence spread across fields can add together instead of using only the best field.",
    rankingLogic: [
      "Replace the single best_fields multi_match query with summed field-specific BM25 match clauses.",
      "Keep the same title, abstract, and text boosts as the baseline.",
      "Require at least one field to match while allowing scores from multiple fields to accumulate.",
      "No query-specific result overrides, runtime LLM calls, personalization, or learning-to-rank model are used in the candidate."
    ],
    techniquesApplied: [
      "OpenSearch English analyzer",
      "BM25 field-specific match scoring",
      "summed title, abstract, and text evidence",
      "dataset filter for Cranfield documents"
    ],
    targetedFailureGroups: ["late_first_relevant", "broad_need_low_recall", "partial_recall"]
  },
  "coverage-rerank": {
    id: "coverage-rerank",
    label: "SE-0002 coverage-rerank candidate",
    status: "candidate",
    searchEvolutionId: "SE-0002",
    architectureVersion: "ARCH-0.2-candidate",
    architectureSlug: "v0.2-candidate-cranfield-coverage-rerank",
    architectureDecisionIds: ["ADL-0002"],
    queryStrategy:
      "Retrieve the top 50 with field-sum BM25, then apply a small deterministic title/abstract query-term coverage bonus before returning the requested results.",
    rankingLogic: [
      "Use the field-sum candidate as the OpenSearch retrieval floor.",
      "Normalize the OpenSearch score within the retrieved set.",
      "Add a small title and abstract coverage bonus for significant query terms.",
      "Return the requested result count after reranking the top 50 candidates.",
      "No query-specific result overrides, runtime LLM calls, personalization, or learning-to-rank model are used in the candidate."
    ],
    techniquesApplied: [
      "OpenSearch English analyzer",
      "BM25 field-specific match scoring",
      "summed title, abstract, and text evidence",
      "deterministic title/abstract coverage rerank",
      "dataset filter for Cranfield documents"
    ],
    targetedFailureGroups: ["zero_relevant_at_k", "late_first_relevant", "lexical_noise_low_precision"]
  },
  "prf-rerank": {
    id: "prf-rerank",
    label: "SE-0002 pseudo-relevance-feedback rerank candidate",
    status: "candidate",
    searchEvolutionId: "SE-0002",
    architectureVersion: "ARCH-0.2-candidate",
    architectureSlug: "v0.2-candidate-cranfield-prf-rerank",
    architectureDecisionIds: ["ADL-0002"],
    queryStrategy:
      "Retrieve the top 50 with field-sum BM25, derive feedback terms from the highest-ranked titles and abstracts, then rerank candidates with original-query and feedback-term coverage.",
    rankingLogic: [
      "Use the field-sum candidate as the OpenSearch retrieval floor.",
      "Extract expansion terms from the top retrieved titles and abstracts using pseudo-relevance feedback.",
      "Normalize the OpenSearch score within the retrieved set.",
      "Add deterministic original-query and feedback-term title/abstract coverage bonuses.",
      "Add a small original-query phrase coherence bonus for adjacent significant query terms in titles and abstracts.",
      "Return the requested result count after reranking the top 50 candidates.",
      "No query-specific result overrides, runtime LLM calls, personalization, or learning-to-rank model are used in the candidate."
    ],
    techniquesApplied: [
      "OpenSearch English analyzer",
      "BM25 field-specific match scoring",
      "summed title, abstract, and text evidence",
      "pseudo-relevance feedback over top titles and abstracts",
      "deterministic title/abstract coverage rerank",
      "deterministic phrase coherence rerank",
      "dataset filter for Cranfield documents"
    ],
    targetedFailureGroups: ["zero_relevant_at_k", "late_first_relevant", "lexical_noise_low_precision", "partial_recall"]
  },
  "prf-expand-rerank": {
    id: "prf-expand-rerank",
    label: "SE-0002 PRF expanded-retrieval rerank candidate",
    status: "candidate",
    searchEvolutionId: "SE-0002",
    architectureVersion: "ARCH-0.2-candidate",
    architectureSlug: "v0.2-candidate-cranfield-prf-expand-rerank",
    architectureDecisionIds: ["ADL-0002"],
    queryStrategy:
      "Retrieve top candidates with field-sum BM25, derive feedback terms, issue a second feedback-expanded OpenSearch retrieval, then rerank the merged pool.",
    rankingLogic: [
      "Use field-sum BM25 as the first-stage retrieval floor.",
      "Extract expansion terms from the top retrieved titles and abstracts using pseudo-relevance feedback.",
      "Run a second OpenSearch query that includes original query clauses and lower-weight feedback-term clauses.",
      "Merge the original and expanded retrieval pools, preserving original and expanded ranks.",
      "Rerank with normalized original score, normalized expanded score, and original-query plus feedback-term coverage.",
      "Return the requested result count after reranking the merged candidates.",
      "No query-specific result overrides, runtime LLM calls, personalization, or learning-to-rank model are used in the candidate."
    ],
    techniquesApplied: [
      "OpenSearch English analyzer",
      "BM25 field-specific match scoring",
      "summed title, abstract, and text evidence",
      "pseudo-relevance feedback over top titles and abstracts",
      "feedback-expanded second-stage retrieval",
      "deterministic merged-pool rerank",
      "dataset filter for Cranfield documents"
    ],
    targetedFailureGroups: ["zero_relevant_at_k", "broad_need_low_recall", "partial_recall", "late_first_relevant"]
  }
};

export function resolveSearchArchitecture(value = DEFAULT_SEARCH_ARCHITECTURE_ID) {
  const normalized = String(value || DEFAULT_SEARCH_ARCHITECTURE_ID).trim().toLowerCase();
  const aliases = {
    default: "baseline",
    v0: "baseline",
    "v0.1": "baseline",
    bm25: "baseline",
    baseline: "baseline",
    "query-rescue": "query-rescue",
    query_rescue: "query-rescue",
    rescue: "query-rescue",
    "field-sum": "field-sum",
    field_sum: "field-sum",
    "summed-fields": "field-sum",
    "coverage-rerank": "coverage-rerank",
    coverage_rerank: "coverage-rerank",
    rerank: "coverage-rerank",
    "prf-rerank": "prf-rerank",
    prf_rerank: "prf-rerank",
    prf: "prf-rerank",
    rm3: "prf-rerank",
    "prf-expand-rerank": "prf-expand-rerank",
    prf_expand_rerank: "prf-expand-rerank",
    "prf-expanded-rerank": "prf-expand-rerank",
    prf_expand: "prf-expand-rerank",
    "rm3-expand": "prf-expand-rerank",
    "v0.2-candidate": "field-sum"
  };
  const id = aliases[normalized];

  if (!id || !SEARCH_ARCHITECTURES[id]) {
    throw new ValidationError(
      "architecture must be baseline, query-rescue, field-sum, coverage-rerank, prf-rerank, or prf-expand-rerank",
      "invalid_architecture"
    );
  }

  return SEARCH_ARCHITECTURES[id];
}

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

export const RANKING_LOGIC = SEARCH_ARCHITECTURES.baseline.rankingLogic;

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

const FLOW_QUERY = RETRIEVAL_FLOW[0];
const FLOW_NORMALIZE = RETRIEVAL_FLOW[1];
const FLOW_EXPLAIN = RETRIEVAL_FLOW[RETRIEVAL_FLOW.length - 1];

export const ARCHITECTURE_RETRIEVAL_FLOWS = {
  baseline: RETRIEVAL_FLOW,
  "query-rescue": [
    FLOW_QUERY,
    FLOW_NORMALIZE,
    {
      id: "build",
      title: "OpenSearch Query",
      detail: "The baseline multi_match recall clause is combined with phrase-proximity and all-keyword boost clauses."
    },
    {
      id: "retrieve",
      title: "Retrieve",
      detail: "OpenSearch searches the live cranfield-v0 index."
    },
    {
      id: "rank",
      title: "Rank",
      detail: "BM25 scores documents; phrase and cross-field boosts lift focused technical matches."
    },
    FLOW_EXPLAIN
  ],
  "field-sum": [
    FLOW_QUERY,
    FLOW_NORMALIZE,
    {
      id: "build",
      title: "OpenSearch Query",
      detail: "Separate boosted BM25 match clauses target title, abstract, and text so field evidence adds together."
    },
    {
      id: "retrieve",
      title: "Retrieve",
      detail: "OpenSearch searches the live cranfield-v0 index."
    },
    {
      id: "rank",
      title: "Rank",
      detail: "Summed field-specific BM25 scores rank documents with the baseline title and abstract boosts."
    },
    FLOW_EXPLAIN
  ],
  "coverage-rerank": [
    FLOW_QUERY,
    FLOW_NORMALIZE,
    {
      id: "build",
      title: "OpenSearch Query",
      detail: "Summed field-specific BM25 match clauses target title, abstract, and text."
    },
    {
      id: "retrieve",
      title: "Retrieve",
      detail: "OpenSearch retrieves the top 50 candidates from the live cranfield-v0 index."
    },
    {
      id: "rank",
      title: "Rank",
      detail: "Summed field-specific BM25 scores order the candidate pool."
    },
    {
      id: "rerank",
      title: "Rerank",
      detail: "A deterministic title/abstract query-term coverage bonus reorders the candidates before returning results."
    },
    FLOW_EXPLAIN
  ],
  "prf-rerank": [
    FLOW_QUERY,
    FLOW_NORMALIZE,
    {
      id: "build",
      title: "OpenSearch Query",
      detail: "Summed field-specific BM25 match clauses target title, abstract, and text."
    },
    {
      id: "retrieve",
      title: "Retrieve",
      detail: "OpenSearch retrieves the top 50 candidates from the live cranfield-v0 index."
    },
    {
      id: "rank",
      title: "Rank",
      detail: "Summed field-specific BM25 scores order the candidate pool."
    },
    {
      id: "feedback",
      title: "Feedback",
      detail: "Pseudo-relevance feedback extracts expansion terms from the top-ranked titles and abstracts."
    },
    {
      id: "rerank",
      title: "Rerank",
      detail: "Candidates are reranked with normalized BM25 plus original-term, feedback-term, and phrase-coherence coverage bonuses."
    },
    FLOW_EXPLAIN
  ],
  "prf-expand-rerank": [
    FLOW_QUERY,
    FLOW_NORMALIZE,
    {
      id: "build",
      title: "OpenSearch Query",
      detail: "Summed field-specific BM25 match clauses target title, abstract, and text."
    },
    {
      id: "retrieve",
      title: "Retrieve",
      detail: "OpenSearch retrieves the first-stage candidate pool from the live cranfield-v0 index."
    },
    {
      id: "rank",
      title: "Rank",
      detail: "Summed field-specific BM25 scores order the first-stage pool."
    },
    {
      id: "feedback",
      title: "Feedback",
      detail: "Pseudo-relevance feedback extracts expansion terms from the top-ranked titles and abstracts."
    },
    {
      id: "expand",
      title: "Expanded Retrieve",
      detail: "A second OpenSearch query adds lower-weight feedback-term clauses and the retrieval pools are merged."
    },
    {
      id: "rerank",
      title: "Rerank",
      detail: "The merged pool is reranked with normalized original and expanded scores plus coverage bonuses."
    },
    FLOW_EXPLAIN
  ]
};

export function architectureRetrievalFlow(architectureId) {
  return ARCHITECTURE_RETRIEVAL_FLOWS[architectureId] || RETRIEVAL_FLOW;
}

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

export const CRANFIELD_PAPER_BM25_INDEX_BODY = {
  settings: {
    index: {
      number_of_shards: 1,
      number_of_replicas: 0,
      similarity: {
        paper_bm25: {
          type: "BM25",
          k1: 1.5,
          b: 0.75
        }
      }
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
        similarity: "paper_bm25",
        fields: {
          keyword: { type: "keyword", ignore_above: 256 }
        }
      },
      abstract: {
        type: "text",
        analyzer: "cranfield_english",
        similarity: "paper_bm25"
      },
      text: {
        type: "text",
        analyzer: "cranfield_english",
        similarity: "paper_bm25"
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
