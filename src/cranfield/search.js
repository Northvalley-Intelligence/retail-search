import { executeOpenSearchSearch, getOpenSearchIndex } from "../opensearch.js";
import { traceabilityPayload } from "../traceability.js";
import {
  ARCHITECTURE_VERSION,
  DATASET_ID,
  DEFAULT_SEARCH_ARCHITECTURE_ID,
  DEFAULT_INDEX,
  QUERY_RESCUE_SEARCH_FIELDS,
  RANKING_LOGIC,
  SEARCH_FIELDS,
  assertNonEmptyQuery,
  normalizeQuery,
  parseResultSize,
  resolveSearchArchitecture
} from "./schema.js";

const COVERAGE_RERANK_RETRIEVE_SIZE = 50;
const COVERAGE_RERANK_WEIGHT = 0.08;
const PRF_RERANK_RETRIEVE_SIZE = 50;
const PRF_FEEDBACK_DOCUMENTS = 4;
const PRF_FEEDBACK_TERMS = 8;
const PRF_ORIGINAL_WEIGHT = 0.06;
const PRF_EXPANSION_WEIGHT = 0.14;
const PRF_PHRASE_WEIGHT = 0.01;
const PRF_EXPANDED_INITIAL_RETRIEVE_SIZE = 50;
const PRF_EXPANDED_SECOND_RETRIEVE_SIZE = 80;
const PRF_EXPANDED_ORIGINAL_SCORE_WEIGHT = 0.62;
const PRF_EXPANDED_SECOND_SCORE_WEIGHT = 0.38;
const PRF_EXPANDED_ORIGINAL_COVERAGE_WEIGHT = 0.06;
const PRF_EXPANDED_EXPANSION_COVERAGE_WEIGHT = 0.14;
const COVERAGE_RERANK_STOPWORDS = new Set([
  "what",
  "are",
  "is",
  "the",
  "a",
  "an",
  "of",
  "to",
  "in",
  "and",
  "or",
  "for",
  "with",
  "on",
  "by",
  "from",
  "has",
  "have",
  "been",
  "be",
  "can",
  "did",
  "does",
  "do",
  "about",
  "at",
  "which",
  "that",
  "this",
  "into",
  "it",
  "anyone",
  "else",
  "not",
  "so",
  "far",
  "must",
  "when",
  "under",
  "over",
  "based",
  "as",
  "some",
  "using",
  "than",
  "other",
  "possible",
  "available",
  "could",
  "would",
  "should",
  "there",
  "any",
  "just",
  "how",
  "why",
  "if",
  "then",
  "where",
  "who",
  "whose",
  "such",
  "these",
  "those",
  "was",
  "were",
  "will",
  "shall",
  "may",
  "might",
  "its",
  "their",
  "but",
  "all",
  "after",
  "before",
  "beyond",
  "between",
  "while",
  "during",
  "per",
  "via",
  "also",
  "used",
  "use",
  "due",
  "out",
  "up",
  "down",
  "high",
  "low",
  "very"
]);
const PRF_RERANK_STOPWORDS = new Set([
  ...COVERAGE_RERANK_STOPWORDS,
  "information",
  "method",
  "methods",
  "problem",
  "problems",
  "results",
  "result",
  "data",
  "effect",
  "effects",
  "solution",
  "solutions",
  "available",
  "determine",
  "determined",
  "calculated",
  "calculation",
  "investigation",
  "investigations",
  "study",
  "studies",
  "paper",
  "papers"
]);

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function isFieldSumLike(searchArchitecture) {
  return (
    searchArchitecture.id === "field-sum" ||
    searchArchitecture.id === "coverage-rerank" ||
    searchArchitecture.id === "prf-rerank" ||
    searchArchitecture.id === "prf-expand-rerank"
  );
}

function fieldSumClauses(query, boosts = { title: 3, abstract: 2, text: 1 }) {
  return [
    {
      match: {
        title: {
          query,
          operator: "or",
          boost: boosts.title
        }
      }
    },
    {
      match: {
        abstract: {
          query,
          operator: "or",
          boost: boosts.abstract
        }
      }
    },
    {
      match: {
        text: {
          query,
          operator: "or",
          boost: boosts.text
        }
      }
    }
  ];
}

function significantTokens(value, stopwords = COVERAGE_RERANK_STOPWORDS) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stopwords.has(token));
}

function coverageTokens(value) {
  return significantTokens(value, COVERAGE_RERANK_STOPWORDS);
}

function internalRetrieveSize(value, defaultSize) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultSize;
}

function coverageScoreForTokens(tokens, result, stopwords = COVERAGE_RERANK_STOPWORDS) {
  const queryTokens = Array.from(new Set(tokens));
  if (queryTokens.length === 0) {
    return 0;
  }

  const titleTokens = new Set(significantTokens(result.title, stopwords));
  const abstractTokens = new Set(significantTokens(result.abstract, stopwords));
  let titleHits = 0;
  let abstractHits = 0;
  let anyHits = 0;

  for (const token of queryTokens) {
    const titleHit = titleTokens.has(token);
    const abstractHit = abstractTokens.has(token);
    if (titleHit) titleHits += 1;
    if (abstractHit) abstractHits += 1;
    if (titleHit || abstractHit) anyHits += 1;
  }

  const denominator = queryTokens.length;
  return (3 * titleHits) / denominator + (2 * abstractHits) / denominator + anyHits / denominator;
}

function bigrams(tokens) {
  const rows = [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    rows.push(`${tokens[index]} ${tokens[index + 1]}`);
  }
  return rows;
}

function phraseCoverageScore(tokens, result, stopwords = COVERAGE_RERANK_STOPWORDS) {
  const queryPhrases = Array.from(new Set(bigrams(tokens)));
  if (queryPhrases.length === 0) {
    return 0;
  }

  const titlePhrases = new Set(bigrams(significantTokens(result.title, stopwords)));
  const abstractPhrases = new Set(bigrams(significantTokens(result.abstract, stopwords)));
  let titleHits = 0;
  let abstractHits = 0;

  for (const phrase of queryPhrases) {
    if (titlePhrases.has(phrase)) titleHits += 1;
    if (abstractPhrases.has(phrase)) abstractHits += 1;
  }

  return (3 * titleHits) / queryPhrases.length + (2 * abstractHits) / queryPhrases.length;
}

function coverageScore(query, result) {
  return coverageScoreForTokens(coverageTokens(query), result);
}

function rerankByCoverage(query, results) {
  const maxScore = Math.max(...results.map((result) => result.score || 0), 1);
  return results
    .map((result, index) => ({
      ...result,
      rerankScore: Math.round((((result.score || 0) / maxScore + COVERAGE_RERANK_WEIGHT * coverageScore(query, result)) * 10000)) / 10000,
      originalRank: index + 1
    }))
    .sort((a, b) => b.rerankScore - a.rerankScore || a.originalRank - b.originalRank);
}

function feedbackTerms(results, originalTokens) {
  const original = new Set(originalTokens);
  const weights = new Map();
  const feedbackResults = results.slice(0, PRF_FEEDBACK_DOCUMENTS);

  feedbackResults.forEach((result, index) => {
    const rankWeight = 1 / (index + 1);
    const feedbackText = `${result.title || ""} ${result.title || ""} ${result.abstract || ""}`;
    for (const token of significantTokens(feedbackText, PRF_RERANK_STOPWORDS)) {
      if (!original.has(token)) {
        weights.set(token, (weights.get(token) || 0) + rankWeight);
      }
    }
  });

  return Array.from(weights.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, PRF_FEEDBACK_TERMS)
    .map(([token]) => token);
}

function rerankByPseudoRelevanceFeedback(query, results) {
  const originalTokens = significantTokens(query, PRF_RERANK_STOPWORDS);
  const expansionTerms = feedbackTerms(results, originalTokens);
  const maxScore = Math.max(...results.map((result) => result.score || 0), 1);
  const reranked = results
    .map((result, index) => ({
      ...result,
      rerankScore:
        Math.round(
          (((result.score || 0) / maxScore +
            PRF_ORIGINAL_WEIGHT * coverageScoreForTokens(originalTokens, result, PRF_RERANK_STOPWORDS) +
            PRF_EXPANSION_WEIGHT * coverageScoreForTokens(expansionTerms, result, PRF_RERANK_STOPWORDS) +
            PRF_PHRASE_WEIGHT * phraseCoverageScore(originalTokens, result, PRF_RERANK_STOPWORDS)) *
            10000)
        ) / 10000,
      originalRank: index + 1
    }))
    .sort((a, b) => b.rerankScore - a.rerankScore || a.originalRank - b.originalRank);

  return {
    results: reranked,
    expansionTerms
  };
}

function mergeResultPools(originalResults, expandedResults) {
  const merged = new Map();

  originalResults.forEach((result, index) => {
    merged.set(result.id, {
      ...result,
      originalScore: result.score || 0,
      expandedScore: 0,
      originalRank: index + 1,
      expandedRank: null,
      retrievalSources: ["original"]
    });
  });

  expandedResults.forEach((result, index) => {
    const existing = merged.get(result.id);
    if (existing) {
      existing.expandedScore = Math.max(existing.expandedScore, result.score || 0);
      existing.expandedRank = existing.expandedRank || index + 1;
      if (!existing.retrievalSources.includes("expanded")) {
        existing.retrievalSources.push("expanded");
      }
    } else {
      merged.set(result.id, {
        ...result,
        originalScore: 0,
        expandedScore: result.score || 0,
        originalRank: null,
        expandedRank: index + 1,
        retrievalSources: ["expanded"]
      });
    }
  });

  return Array.from(merged.values());
}

function rerankByExpandedPseudoRelevanceFeedback(query, originalResults, expandedResults, expansionTerms) {
  const originalTokens = significantTokens(query, PRF_RERANK_STOPWORDS);
  const mergedResults = mergeResultPools(originalResults, expandedResults);
  const maxOriginalScore = Math.max(...originalResults.map((result) => result.score || 0), 1);
  const maxExpandedScore = Math.max(...expandedResults.map((result) => result.score || 0), 1);
  const reranked = mergedResults
    .map((result) => ({
      ...result,
      rerankScore:
        Math.round(
          ((PRF_EXPANDED_ORIGINAL_SCORE_WEIGHT * ((result.originalScore || 0) / maxOriginalScore) +
            PRF_EXPANDED_SECOND_SCORE_WEIGHT * ((result.expandedScore || 0) / maxExpandedScore) +
            PRF_EXPANDED_ORIGINAL_COVERAGE_WEIGHT * coverageScoreForTokens(originalTokens, result, PRF_RERANK_STOPWORDS) +
            PRF_EXPANDED_EXPANSION_COVERAGE_WEIGHT * coverageScoreForTokens(expansionTerms, result, PRF_RERANK_STOPWORDS)) *
            10000)
        ) / 10000
    }))
    .sort(
      (a, b) =>
        b.rerankScore - a.rerankScore ||
        (a.originalRank ?? Number.MAX_SAFE_INTEGER) - (b.originalRank ?? Number.MAX_SAFE_INTEGER) ||
        (a.expandedRank ?? Number.MAX_SAFE_INTEGER) - (b.expandedRank ?? Number.MAX_SAFE_INTEGER)
    );

  return {
    results: reranked,
    expansionTerms,
    mergedCandidateCount: mergedResults.length
  };
}

export function buildCranfieldSearchBody(query, options = {}) {
  const normalized = normalizeQuery(query);
  assertNonEmptyQuery(normalized.normalized);

  const requestedSize = parseResultSize(options.size, 10);
  const searchArchitecture = resolveSearchArchitecture(options.architecture);
  const size =
    searchArchitecture.id === "coverage-rerank"
      ? Math.max(requestedSize, COVERAGE_RERANK_RETRIEVE_SIZE)
      : searchArchitecture.id === "prf-rerank"
        ? Math.max(requestedSize, PRF_RERANK_RETRIEVE_SIZE)
        : searchArchitecture.id === "prf-expand-rerank"
          ? Math.max(requestedSize, PRF_EXPANDED_INITIAL_RETRIEVE_SIZE)
          : requestedSize;
  const fieldSumQueryClauses = fieldSumClauses(normalized.normalized);
  const baselineClause = {
    multi_match: {
      query: normalized.normalized,
      fields: SEARCH_FIELDS,
      type: "best_fields",
      operator: "or"
    }
  };
  const must = isFieldSumLike(searchArchitecture) ? [] : [baselineClause];
  const should =
    searchArchitecture.id === "query-rescue"
      ? [
          {
            multi_match: {
              query: normalized.normalized,
              fields: QUERY_RESCUE_SEARCH_FIELDS,
              type: "phrase",
              slop: 3,
              boost: 3
            }
          },
          {
            multi_match: {
              query: normalized.normalized,
              fields: SEARCH_FIELDS,
              type: "cross_fields",
              operator: "and",
              boost: 2
            }
          },
          {
            multi_match: {
              query: normalized.normalized,
              fields: SEARCH_FIELDS,
              type: "best_fields",
              operator: "or",
              minimum_should_match: "70%",
              boost: 1.5
            }
          }
        ]
      : isFieldSumLike(searchArchitecture)
        ? fieldSumQueryClauses
        : undefined;

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
        ...(must.length ? { must } : {}),
        ...(should ? { should, minimum_should_match: isFieldSumLike(searchArchitecture) ? 1 : undefined } : {})
      }
    }
  };
}

export function buildPrfExpandedSearchBody(query, expansionTerms, options = {}) {
  const normalized = normalizeQuery(query);
  assertNonEmptyQuery(normalized.normalized);
  const expansionQuery = Array.from(new Set(expansionTerms || []))
    .filter(Boolean)
    .join(" ");
  const should = [
    ...fieldSumClauses(normalized.normalized),
    ...(expansionQuery ? fieldSumClauses(expansionQuery, { title: 1.4, abstract: 1.1, text: 0.4 }) : [])
  ];

  return {
    size: Math.max(internalRetrieveSize(options.size, PRF_EXPANDED_SECOND_RETRIEVE_SIZE), PRF_EXPANDED_SECOND_RETRIEVE_SIZE),
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
        should,
        minimum_should_match: 1
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
  includeOpenSearchQuery = false,
  architecture = DEFAULT_SEARCH_ARCHITECTURE_ID
}) {
  const startedAt = nowMs();
  const normalized = normalizeQuery(query);
  assertNonEmptyQuery(normalized.normalized);
  const searchArchitecture = resolveSearchArchitecture(architecture);
  const requestedSize = parseResultSize(size, 10);
  const openSearchSize =
    searchArchitecture.id === "coverage-rerank"
      ? Math.max(requestedSize, COVERAGE_RERANK_RETRIEVE_SIZE)
      : searchArchitecture.id === "prf-rerank"
        ? Math.max(requestedSize, PRF_RERANK_RETRIEVE_SIZE)
        : searchArchitecture.id === "prf-expand-rerank"
          ? Math.max(requestedSize, PRF_EXPANDED_INITIAL_RETRIEVE_SIZE)
          : requestedSize;

  const index = getOpenSearchIndex(env, DEFAULT_INDEX);
  const openSearchQuery = buildCranfieldSearchBody(normalized.normalized, {
    size: requestedSize,
    architecture: searchArchitecture.id
  });
  const payload = await executeOpenSearchSearch({
    env,
    index,
    body: openSearchQuery,
    fetchImpl
  });

  const latencyMs = Math.round((nowMs() - startedAt) * 100) / 100;
  const retrievedResults = (payload?.hits?.hits || []).map(mapHit);
  const prfRerank =
    searchArchitecture.id === "prf-rerank" ? rerankByPseudoRelevanceFeedback(normalized.normalized, retrievedResults) : null;
  const originalTokens = significantTokens(normalized.normalized, PRF_RERANK_STOPWORDS);
  const prfExpandedTerms =
    searchArchitecture.id === "prf-expand-rerank" ? feedbackTerms(retrievedResults, originalTokens) : [];
  const expandedOpenSearchQuery =
    searchArchitecture.id === "prf-expand-rerank"
      ? buildPrfExpandedSearchBody(normalized.normalized, prfExpandedTerms, { size: PRF_EXPANDED_SECOND_RETRIEVE_SIZE })
      : null;
  const expandedPayload = expandedOpenSearchQuery
    ? await executeOpenSearchSearch({
        env,
        index,
        body: expandedOpenSearchQuery,
        fetchImpl
      })
    : null;
  const expandedResults = (expandedPayload?.hits?.hits || []).map(mapHit);
  const prfExpandedRerank =
    searchArchitecture.id === "prf-expand-rerank"
      ? rerankByExpandedPseudoRelevanceFeedback(normalized.normalized, retrievedResults, expandedResults, prfExpandedTerms)
      : null;
  const results =
    searchArchitecture.id === "coverage-rerank"
      ? rerankByCoverage(normalized.normalized, retrievedResults).slice(0, requestedSize)
      : searchArchitecture.id === "prf-rerank"
        ? prfRerank.results.slice(0, requestedSize)
        : searchArchitecture.id === "prf-expand-rerank"
          ? prfExpandedRerank.results.slice(0, requestedSize)
          : retrievedResults.slice(0, requestedSize);

  const latencyMsWithExpansion = Math.round((nowMs() - startedAt) * 100) / 100;

  const response = {
    query: normalized.normalized,
    incomingQuery: normalized.incoming,
    dataset: DATASET_ID,
    architectureVersion: env.ARCHITECTURE_VERSION || ARCHITECTURE_VERSION,
    traceability: traceabilityPayload(env),
    searchArchitecture,
    index,
    ranking: searchArchitecture.rankingLogic || RANKING_LOGIC,
    resultCount: results.length,
    totalHits: getTotalHits(payload),
    results,
    latency: {
      apiMs: latencyMsWithExpansion,
      openSearchTookMs: payload?.took ?? null,
      expandedOpenSearchTookMs: expandedPayload?.took ?? null
    }
  };

  if (searchArchitecture.id === "coverage-rerank") {
    response.reranking = {
      strategy: "title_abstract_coverage",
      retrieveSize: openSearchSize,
      returnedSize: requestedSize,
      coverageWeight: COVERAGE_RERANK_WEIGHT
    };
  }

  if (searchArchitecture.id === "prf-rerank") {
    response.reranking = {
      strategy: "pseudo_relevance_feedback_title_abstract_coverage",
      retrieveSize: openSearchSize,
      returnedSize: requestedSize,
      feedbackDocuments: PRF_FEEDBACK_DOCUMENTS,
      feedbackTerms: PRF_FEEDBACK_TERMS,
      originalWeight: PRF_ORIGINAL_WEIGHT,
      expansionWeight: PRF_EXPANSION_WEIGHT,
      phraseWeight: PRF_PHRASE_WEIGHT,
      expansionTerms: prfRerank.expansionTerms
    };
  }

  if (searchArchitecture.id === "prf-expand-rerank") {
    response.reranking = {
      strategy: "pseudo_relevance_feedback_expanded_retrieval_rerank",
      retrieveSize: openSearchSize,
      expandedRetrieveSize: PRF_EXPANDED_SECOND_RETRIEVE_SIZE,
      returnedSize: requestedSize,
      feedbackDocuments: PRF_FEEDBACK_DOCUMENTS,
      feedbackTerms: PRF_FEEDBACK_TERMS,
      originalScoreWeight: PRF_EXPANDED_ORIGINAL_SCORE_WEIGHT,
      expandedScoreWeight: PRF_EXPANDED_SECOND_SCORE_WEIGHT,
      originalWeight: PRF_EXPANDED_ORIGINAL_COVERAGE_WEIGHT,
      expansionWeight: PRF_EXPANDED_EXPANSION_COVERAGE_WEIGHT,
      expansionTerms: prfExpandedRerank.expansionTerms,
      mergedCandidateCount: prfExpandedRerank.mergedCandidateCount
    };
  }

  if (includeOpenSearchQuery) {
    response.openSearchQuery = openSearchQuery;
    if (expandedOpenSearchQuery) {
      response.expandedOpenSearchQuery = expandedOpenSearchQuery;
    }
  }

  return response;
}
