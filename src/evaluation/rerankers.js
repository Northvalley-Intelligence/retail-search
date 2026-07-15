// Phase 1 rerank techniques ported unchanged for cross-domain evaluation (M-0002.3).
// Algorithms and hyperparameters are frozen at their Cranfield-tuned values per
// Mission Update 002 ("run every Phase 1 portfolio technique unchanged"); only the
// document body field is configurable (Cranfield: abstract, BEIR: text).
// Source of truth for Phase 1 behavior: src/cranfield/search.js (GEN-012/GEN-016).
// TODO(M-0002.3): unify with src/cranfield/search.js via shared exports once no
// detached run is executing that module.

export const COVERAGE_RERANK_WEIGHT = 0.08;
export const PRF_FEEDBACK_DOCUMENTS = 4;
export const PRF_FEEDBACK_TERMS = 8;
export const PRF_ORIGINAL_WEIGHT = 0.06;
export const PRF_EXPANSION_WEIGHT = 0.14;
export const PRF_PHRASE_WEIGHT = 0.01;

export const COVERAGE_RERANK_STOPWORDS = new Set([
  "what", "are", "is", "the", "a", "an", "of", "to", "in", "and", "or", "for",
  "with", "on", "by", "from", "has", "have", "been", "be", "can", "did", "does",
  "do", "about", "at", "which", "that", "this", "into", "it", "anyone", "else",
  "not", "so", "far", "must", "when", "under", "over", "based", "as", "some",
  "using", "than", "other", "possible", "available", "could", "would", "should",
  "there", "any", "just", "how", "why", "if", "then", "where", "who", "whose",
  "such", "these", "those", "was", "were", "will", "shall", "may", "might", "its",
  "their", "but", "all", "after", "before", "beyond", "between", "while", "during",
  "per", "via", "also", "used", "use", "due", "out", "up", "down", "high", "low",
  "very"
]);

export const PRF_RERANK_STOPWORDS = new Set([
  ...COVERAGE_RERANK_STOPWORDS,
  "information", "method", "methods", "problem", "problems", "results", "result",
  "data", "effect", "effects", "solution", "solutions", "available", "determine",
  "determined", "calculated", "calculation", "investigation", "investigations",
  "study", "studies", "paper", "papers"
]);

export function significantTokens(value, stopwords = COVERAGE_RERANK_STOPWORDS) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stopwords.has(token));
}

function bigrams(tokens) {
  const rows = [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    rows.push(`${tokens[index]} ${tokens[index + 1]}`);
  }
  return rows;
}

function bodyText(result, bodyField) {
  return result[bodyField] ?? result.abstract ?? result.text ?? "";
}

export function coverageScoreForTokens(tokens, result, { stopwords = COVERAGE_RERANK_STOPWORDS, bodyField = "abstract" } = {}) {
  const queryTokens = Array.from(new Set(tokens));
  if (queryTokens.length === 0) {
    return 0;
  }

  const titleTokens = new Set(significantTokens(result.title, stopwords));
  const bodyTokens = new Set(significantTokens(bodyText(result, bodyField), stopwords));
  let titleHits = 0;
  let bodyHits = 0;
  let anyHits = 0;

  for (const token of queryTokens) {
    const titleHit = titleTokens.has(token);
    const bodyHit = bodyTokens.has(token);
    if (titleHit) titleHits += 1;
    if (bodyHit) bodyHits += 1;
    if (titleHit || bodyHit) anyHits += 1;
  }

  const denominator = queryTokens.length;
  return (3 * titleHits) / denominator + (2 * bodyHits) / denominator + anyHits / denominator;
}

export function phraseCoverageScore(tokens, result, { stopwords = COVERAGE_RERANK_STOPWORDS, bodyField = "abstract" } = {}) {
  const queryPhrases = Array.from(new Set(bigrams(tokens)));
  if (queryPhrases.length === 0) {
    return 0;
  }

  const titlePhrases = new Set(bigrams(significantTokens(result.title, stopwords)));
  const bodyPhrases = new Set(bigrams(significantTokens(bodyText(result, bodyField), stopwords)));
  let titleHits = 0;
  let bodyHits = 0;

  for (const phrase of queryPhrases) {
    if (titlePhrases.has(phrase)) titleHits += 1;
    if (bodyPhrases.has(phrase)) bodyHits += 1;
  }

  return (3 * titleHits) / queryPhrases.length + (2 * bodyHits) / queryPhrases.length;
}

export function rerankByCoverage(query, results, { bodyField = "abstract" } = {}) {
  const maxScore = Math.max(...results.map((result) => result.score || 0), 1);
  const queryTokens = significantTokens(query, COVERAGE_RERANK_STOPWORDS);
  return results
    .map((result, index) => ({
      ...result,
      rerankScore:
        Math.round(
          (((result.score || 0) / maxScore + COVERAGE_RERANK_WEIGHT * coverageScoreForTokens(queryTokens, result, { bodyField })) * 10000)
        ) / 10000,
      originalRank: index + 1
    }))
    .sort((a, b) => b.rerankScore - a.rerankScore || a.originalRank - b.originalRank);
}

export function feedbackTerms(results, originalTokens, { bodyField = "abstract" } = {}) {
  const original = new Set(originalTokens);
  const weights = new Map();
  const feedbackResults = results.slice(0, PRF_FEEDBACK_DOCUMENTS);

  feedbackResults.forEach((result, index) => {
    const rankWeight = 1 / (index + 1);
    const feedbackText = `${result.title || ""} ${result.title || ""} ${bodyText(result, bodyField)}`;
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

export function rerankByPseudoRelevanceFeedback(query, results, { bodyField = "abstract" } = {}) {
  const stopOptions = { stopwords: PRF_RERANK_STOPWORDS, bodyField };
  const originalTokens = significantTokens(query, PRF_RERANK_STOPWORDS);
  const expansionTerms = feedbackTerms(results, originalTokens, { bodyField });
  const maxScore = Math.max(...results.map((result) => result.score || 0), 1);
  const reranked = results
    .map((result, index) => ({
      ...result,
      rerankScore:
        Math.round(
          (((result.score || 0) / maxScore +
            PRF_ORIGINAL_WEIGHT * coverageScoreForTokens(originalTokens, result, stopOptions) +
            PRF_EXPANSION_WEIGHT * coverageScoreForTokens(expansionTerms, result, stopOptions) +
            PRF_PHRASE_WEIGHT * phraseCoverageScore(originalTokens, result, stopOptions)) *
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
