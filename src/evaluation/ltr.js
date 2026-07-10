import { evaluateRun } from "./metrics.js";
import { dotProduct } from "./vector-search.js";

export const LTR_FEATURE_NAMES = [
  "lexicalScore",
  "rankReciprocal",
  "rankPercentile",
  "titleCoverage",
  "abstractCoverage",
  "anyCoverage",
  "phraseCoverage",
  "feedbackCoverage",
  "prfScore",
  "vectorScore",
  "vectorRankReciprocal",
  "titleLength",
  "abstractLength"
];

const DEFAULT_STOPWORDS = new Set([
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
  "very",
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

function round(value, digits = 6) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export function significantTokens(value, stopwords = DEFAULT_STOPWORDS) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length > 2 && !stopwords.has(token));
}

function unique(values) {
  return Array.from(new Set(values));
}

function bigrams(tokens) {
  const rows = [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    rows.push(`${tokens[index]} ${tokens[index + 1]}`);
  }
  return rows;
}

function tokenCoverage(tokens, fieldTokens) {
  const queryTokens = unique(tokens);
  if (!queryTokens.length) {
    return 0;
  }
  const fieldTokenSet = new Set(fieldTokens);
  return queryTokens.filter((token) => fieldTokenSet.has(token)).length / queryTokens.length;
}

function phraseCoverage(tokens, result) {
  const queryPhrases = unique(bigrams(tokens));
  if (!queryPhrases.length) {
    return 0;
  }
  const fieldPhrases = new Set([...bigrams(significantTokens(result.title)), ...bigrams(significantTokens(result.abstract))]);
  return queryPhrases.filter((phrase) => fieldPhrases.has(phrase)).length / queryPhrases.length;
}

export function feedbackTerms(results, originalTokens, options = {}) {
  const feedbackDocuments = Number(options.feedbackDocuments || 4);
  const feedbackTermCount = Number(options.feedbackTerms || 8);
  const original = new Set(originalTokens);
  const weights = new Map();

  results.slice(0, feedbackDocuments).forEach((result, index) => {
    const rankWeight = 1 / (index + 1);
    const text = `${result.title || ""} ${result.title || ""} ${result.abstract || ""}`;
    for (const token of significantTokens(text)) {
      if (!original.has(token)) {
        weights.set(token, (weights.get(token) || 0) + rankWeight);
      }
    }
  });

  return Array.from(weights.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, feedbackTermCount)
    .map(([token]) => token);
}

function minMax(values) {
  if (!values.length) {
    return { min: 0, max: 0, range: 1 };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max, range: max - min || 1 };
}

function normalized(value, scale) {
  return (Number(value || 0) - scale.min) / scale.range;
}

function relevanceFor(testCase, id) {
  return Math.max(0, Number(testCase.qrels?.[id] || 0));
}

function vectorScoresForCase(testCase, embeddingContext) {
  if (!embeddingContext?.queryEmbeddingsById || !embeddingContext?.documentEmbeddingsById) {
    return new Map();
  }
  const queryEmbedding = embeddingContext.queryEmbeddingsById.get(String(testCase.queryId))?.embedding;
  if (!queryEmbedding) {
    return new Map();
  }

  return new Map(
    (testCase.results || []).map((result) => {
      const documentEmbedding = embeddingContext.documentEmbeddingsById.get(String(result.id))?.embedding;
      return [result.id, documentEmbedding ? dotProduct(queryEmbedding, documentEmbedding) : 0];
    })
  );
}

export function buildFeatureRowsForCase(testCase, options = {}) {
  const results = testCase.results || [];
  const originalTokens = significantTokens(testCase.query);
  const expansionTerms = feedbackTerms(results, originalTokens, options);
  const lexicalScale = minMax(results.map((result) => Number(result.score || 0)));
  const vectorScores = vectorScoresForCase(testCase, options.embeddingContext);
  const vectorScale = minMax(Array.from(vectorScores.values()));
  const vectorRankById = new Map(
    Array.from(vectorScores.entries())
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
      .map(([id], index) => [id, index + 1])
  );

  return results.map((result, index) => {
    const titleTokens = significantTokens(result.title);
    const abstractTokens = significantTokens(result.abstract);
    const titleCoverage = tokenCoverage(originalTokens, titleTokens);
    const abstractCoverage = tokenCoverage(originalTokens, abstractTokens);
    const anyCoverage = tokenCoverage(originalTokens, [...titleTokens, ...abstractTokens]);
    const phrase = phraseCoverage(originalTokens, result);
    const feedbackCoverage = tokenCoverage(expansionTerms, [...titleTokens, ...abstractTokens]);
    const lexicalScore = normalized(result.score, lexicalScale);
    const vectorScore = vectorScores.has(result.id) ? normalized(vectorScores.get(result.id), vectorScale) : 0;
    const originalRank = index + 1;
    const vectorRank = vectorRankById.get(result.id) || results.length;
    const featureValues = {
      lexicalScore: round(lexicalScore),
      rankReciprocal: round(1 / originalRank),
      rankPercentile: round((results.length - index) / Math.max(results.length, 1)),
      titleCoverage: round(titleCoverage),
      abstractCoverage: round(abstractCoverage),
      anyCoverage: round(anyCoverage),
      phraseCoverage: round(phrase),
      feedbackCoverage: round(feedbackCoverage),
      prfScore: round(lexicalScore + 0.06 * anyCoverage + 0.14 * feedbackCoverage + 0.01 * phrase),
      vectorScore: round(vectorScore),
      vectorRankReciprocal: round(1 / vectorRank),
      titleLength: round(Math.min(titleTokens.length / 24, 1)),
      abstractLength: round(Math.min(abstractTokens.length / 180, 1))
    };

    return {
      queryId: String(testCase.queryId),
      id: String(result.id),
      label: relevanceFor(testCase, result.id),
      originalRank,
      result,
      features: featureValues
    };
  });
}

export function buildFeatureRowsByQuery(cases, options = {}) {
  return new Map(cases.map((testCase) => [String(testCase.queryId), buildFeatureRowsForCase(testCase, options)]));
}

export function scoreFeatureRow(row, weights = {}) {
  return LTR_FEATURE_NAMES.reduce((sum, featureName) => sum + Number(weights[featureName] || 0) * Number(row.features[featureName] || 0), 0);
}

function flattenRows(cases, rowsByQueryId) {
  return cases.flatMap((testCase) => rowsByQueryId.get(String(testCase.queryId)) || []);
}

export function rankRows(rows, weights = {}, size = rows.length) {
  return rows
    .map((row) => ({
      ...row,
      ltrScore: scoreFeatureRow(row, weights)
    }))
    .sort((a, b) => b.ltrScore - a.ltrScore || a.originalRank - b.originalRank || a.id.localeCompare(b.id))
    .slice(0, size);
}

export function rerankCases(cases, rowsByQueryId, weights = {}, size = null) {
  return cases.map((testCase) => ({
    ...testCase,
    results: rankRows(rowsByQueryId.get(String(testCase.queryId)) || [], weights, size || testCase.results.length).map((row) => ({
      ...row.result,
      originalRank: row.originalRank,
      ltrScore: round(row.ltrScore, 4)
    }))
  }));
}

export function evaluateWeights(cases, rowsByQueryId, weights = {}, options = {}) {
  const rankedCases = rerankCases(cases, rowsByQueryId, weights, options.retrieveSize);
  return evaluateRun(rankedCases, options.k || 10, { relevanceMode: options.relevanceMode || "graded" });
}

function metricFor(cases, rowsByQueryId, weights, options) {
  return evaluateWeights(cases, rowsByQueryId, weights, options).aggregate.ndcgAtK;
}

function initialWeights() {
  return Object.fromEntries(LTR_FEATURE_NAMES.map((featureName) => [featureName, featureName === "lexicalScore" ? 1 : 0]));
}

export function trainCoordinateAscent(cases, rowsByQueryId, options = {}) {
  const weights = { ...initialWeights(), ...(options.initialWeights || {}) };
  const stepSizes = options.stepSizes || [1, 0.5, 0.25, 0.1, 0.05, 0.02, 0.01];
  const features = options.features || LTR_FEATURE_NAMES;
  const history = [];
  let bestMetric = metricFor(cases, rowsByQueryId, weights, options);

  for (const step of stepSizes) {
    let improved = true;
    let passes = 0;
    while (improved && passes < Number(options.maxPassesPerStep || 4)) {
      improved = false;
      passes += 1;
      for (const featureName of features) {
        let bestCandidate = null;
        for (const direction of [1, -1]) {
          const candidateWeights = {
            ...weights,
            [featureName]: round((weights[featureName] || 0) + direction * step)
          };
          const candidateMetric = metricFor(cases, rowsByQueryId, candidateWeights, options);
          if (candidateMetric > bestMetric + 0.00001) {
            bestCandidate = {
              featureName,
              step,
              metric: candidateMetric,
              weights: candidateWeights
            };
            bestMetric = candidateMetric;
          }
        }
        if (bestCandidate) {
          Object.assign(weights, bestCandidate.weights);
          history.push({
            featureName: bestCandidate.featureName,
            step: bestCandidate.step,
            metric: bestCandidate.metric
          });
          improved = true;
        }
      }
    }
  }

  return {
    weights,
    trainMetric: bestMetric,
    history
  };
}

export function foldForQueryId(queryId, folds = 5) {
  const numeric = Number(String(queryId).replace(/[^0-9]/gu, ""));
  if (Number.isFinite(numeric) && numeric > 0) {
    return (numeric - 1) % folds;
  }
  let hash = 0;
  for (const char of String(queryId)) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash % folds;
}

export function crossValidate(cases, rowsByQueryId, options = {}) {
  const folds = Number(options.folds || 5);
  const foldRuns = [];
  const heldoutCases = [];

  for (let fold = 0; fold < folds; fold += 1) {
    const trainCases = cases.filter((testCase) => foldForQueryId(testCase.queryId, folds) !== fold);
    const testCases = cases.filter((testCase) => foldForQueryId(testCase.queryId, folds) === fold);
    const model = trainCoordinateAscent(trainCases, rowsByQueryId, options);
    const rankedTestCases = rerankCases(testCases, rowsByQueryId, model.weights, options.retrieveSize);
    const testEvaluation = evaluateRun(rankedTestCases, options.k || 10, { relevanceMode: options.relevanceMode || "graded" });
    foldRuns.push({
      fold,
      trainQueryCount: trainCases.length,
      testQueryCount: testCases.length,
      trainNdcgAtK: model.trainMetric,
      testMetrics: {
        map: testEvaluation.aggregate.averagePrecision,
        ndcgAtK: testEvaluation.aggregate.ndcgAtK,
        precisionAtK: testEvaluation.aggregate.precisionAtK,
        recallAtK: testEvaluation.aggregate.recallAtK,
        mrr: testEvaluation.aggregate.reciprocalRank
      },
      weights: model.weights
    });
    heldoutCases.push(...rankedTestCases);
  }

  const originalOrder = new Map(cases.map((testCase, index) => [String(testCase.queryId), index]));
  heldoutCases.sort((a, b) => originalOrder.get(String(a.queryId)) - originalOrder.get(String(b.queryId)));
  const evaluation = evaluateRun(heldoutCases, options.k || 10, { relevanceMode: options.relevanceMode || "graded" });

  return {
    folds,
    metrics: {
      map: evaluation.aggregate.averagePrecision,
      ndcgAtK: evaluation.aggregate.ndcgAtK,
      precisionAtK: evaluation.aggregate.precisionAtK,
      recallAtK: evaluation.aggregate.recallAtK,
      mrr: evaluation.aggregate.reciprocalRank
    },
    evaluation,
    foldRuns
  };
}

export function oracleCases(cases, size = null) {
  return cases.map((testCase) => ({
    ...testCase,
    results: [...(testCase.results || [])]
      .map((result, index) => ({
        ...result,
        originalRank: index + 1,
        oracleLabel: relevanceFor(testCase, result.id)
      }))
      .sort((a, b) => b.oracleLabel - a.oracleLabel || a.originalRank - b.originalRank)
      .slice(0, size || testCase.results.length)
  }));
}

export function candidatePoolRecall(cases) {
  let relevantCount = 0;
  let relevantInPool = 0;
  let queriesWithRelevant = 0;
  let queriesWithRelevantInPool = 0;

  for (const testCase of cases) {
    const poolIds = new Set((testCase.results || []).map((result) => String(result.id)));
    const relevantIds = Object.entries(testCase.qrels || {})
      .filter(([, grade]) => Number(grade) > 0)
      .map(([id]) => String(id));
    const hits = relevantIds.filter((id) => poolIds.has(id)).length;
    relevantCount += relevantIds.length;
    relevantInPool += hits;
    if (relevantIds.length > 0) {
      queriesWithRelevant += 1;
    }
    if (hits > 0) {
      queriesWithRelevantInPool += 1;
    }
  }

  return {
    relevantCount,
    relevantInPool,
    recall: round(relevantInPool / Math.max(relevantCount, 1)),
    queriesWithRelevant,
    queriesWithRelevantInPool,
    queryCoverage: round(queriesWithRelevantInPool / Math.max(queriesWithRelevant, 1))
  };
}

function mean(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function squaredError(values) {
  if (!values.length) {
    return 0;
  }
  const average = mean(values);
  return values.reduce((sum, value) => sum + (value - average) ** 2, 0);
}

function thresholdCandidates(rows, featureName, maxThresholds) {
  const values = unique(rows.map((row) => Number(row.features[featureName] || 0))).sort((a, b) => a - b);
  if (values.length <= 1) {
    return [];
  }
  const thresholds = [];
  const limit = Math.min(maxThresholds, values.length - 1);
  for (let index = 1; index <= limit; index += 1) {
    const valueIndex = Math.floor((index * values.length) / (limit + 1));
    const left = values[Math.max(0, valueIndex - 1)];
    const right = values[Math.min(values.length - 1, valueIndex)];
    thresholds.push((left + right) / 2);
  }
  return unique(thresholds);
}

function fitRegressionTree(rows, residualsByKey, options = {}, depth = 0) {
  const maxDepth = Number(options.maxDepth || 3);
  const minLeafSize = Number(options.minLeafSize || 12);
  const maxThresholds = Number(options.maxThresholds || 16);
  const values = rows.map((row) => residualsByKey.get(`${row.queryId}:${row.id}`) || 0);
  const leafValue = mean(values);

  if (depth >= maxDepth || rows.length < minLeafSize * 2 || squaredError(values) < 0.000001) {
    return {
      leaf: true,
      value: round(leafValue)
    };
  }

  let bestSplit = null;
  const parentError = squaredError(values);
  for (const featureName of LTR_FEATURE_NAMES) {
    for (const threshold of thresholdCandidates(rows, featureName, maxThresholds)) {
      const left = [];
      const right = [];
      for (const row of rows) {
        if (Number(row.features[featureName] || 0) <= threshold) {
          left.push(row);
        } else {
          right.push(row);
        }
      }
      if (left.length < minLeafSize || right.length < minLeafSize) {
        continue;
      }
      const leftValues = left.map((row) => residualsByKey.get(`${row.queryId}:${row.id}`) || 0);
      const rightValues = right.map((row) => residualsByKey.get(`${row.queryId}:${row.id}`) || 0);
      const error = squaredError(leftValues) + squaredError(rightValues);
      if (!bestSplit || error < bestSplit.error) {
        bestSplit = {
          featureName,
          threshold,
          left,
          right,
          error
        };
      }
    }
  }

  if (!bestSplit || bestSplit.error >= parentError) {
    return {
      leaf: true,
      value: round(leafValue)
    };
  }

  return {
    leaf: false,
    featureName: bestSplit.featureName,
    threshold: round(bestSplit.threshold),
    left: fitRegressionTree(bestSplit.left, residualsByKey, options, depth + 1),
    right: fitRegressionTree(bestSplit.right, residualsByKey, options, depth + 1)
  };
}

export function predictTree(tree, row) {
  if (tree.leaf) {
    return tree.value;
  }
  return predictTree(Number(row.features[tree.featureName] || 0) <= tree.threshold ? tree.left : tree.right, row);
}

export function predictBoostedTreeModel(model, row) {
  return model.trees.reduce((score, tree) => score + model.learningRate * predictTree(tree, row), model.baseScore);
}

export function trainBoostedTreeRanker(cases, rowsByQueryId, options = {}) {
  const rows = flattenRows(cases, rowsByQueryId);
  const treeCount = Number(options.treeCount || 80);
  const learningRate = Number(options.learningRate || 0.05);
  const labels = new Map(rows.map((row) => [`${row.queryId}:${row.id}`, Number(row.label || 0)]));
  const predictions = new Map();
  const baseScore = mean(rows.map((row) => Number(row.label || 0)));
  for (const row of rows) {
    predictions.set(`${row.queryId}:${row.id}`, baseScore);
  }

  const trees = [];
  const history = [];
  for (let iteration = 0; iteration < treeCount; iteration += 1) {
    const residuals = new Map(rows.map((row) => {
      const key = `${row.queryId}:${row.id}`;
      return [key, (labels.get(key) || 0) - (predictions.get(key) || 0)];
    }));
    const tree = fitRegressionTree(rows, residuals, options);
    trees.push(tree);
    for (const row of rows) {
      const key = `${row.queryId}:${row.id}`;
      predictions.set(key, (predictions.get(key) || 0) + learningRate * predictTree(tree, row));
    }
    if (iteration === 0 || iteration === treeCount - 1 || (iteration + 1) % 10 === 0) {
      history.push({
        iteration: iteration + 1,
        residualMse: round(mean(rows.map((row) => {
          const key = `${row.queryId}:${row.id}`;
          return ((labels.get(key) || 0) - (predictions.get(key) || 0)) ** 2;
        })))
      });
    }
  }

  return {
    modelType: "pointwise-gradient-boosted-regression-trees",
    baseScore: round(baseScore),
    learningRate,
    treeCount,
    maxDepth: Number(options.maxDepth || 3),
    minLeafSize: Number(options.minLeafSize || 12),
    maxThresholds: Number(options.maxThresholds || 16),
    trees,
    history
  };
}

export function rankRowsWithBoostedTreeModel(rows, model, size = rows.length) {
  return rows
    .map((row) => ({
      ...row,
      ltrScore: predictBoostedTreeModel(model, row)
    }))
    .sort((a, b) => b.ltrScore - a.ltrScore || a.originalRank - b.originalRank || a.id.localeCompare(b.id))
    .slice(0, size);
}

export function rerankCasesWithBoostedTreeModel(cases, rowsByQueryId, model, size = null) {
  return cases.map((testCase) => ({
    ...testCase,
    results: rankRowsWithBoostedTreeModel(rowsByQueryId.get(String(testCase.queryId)) || [], model, size || testCase.results.length).map((row) => ({
      ...row.result,
      originalRank: row.originalRank,
      ltrScore: round(row.ltrScore, 4)
    }))
  }));
}

export function evaluateBoostedTreeModel(cases, rowsByQueryId, model, options = {}) {
  const rankedCases = rerankCasesWithBoostedTreeModel(cases, rowsByQueryId, model, options.retrieveSize);
  return evaluateRun(rankedCases, options.k || 10, { relevanceMode: options.relevanceMode || "graded" });
}

export function crossValidateBoostedTrees(cases, rowsByQueryId, options = {}) {
  const folds = Number(options.folds || 5);
  const foldRuns = [];
  const heldoutCases = [];

  for (let fold = 0; fold < folds; fold += 1) {
    const trainCases = cases.filter((testCase) => foldForQueryId(testCase.queryId, folds) !== fold);
    const testCases = cases.filter((testCase) => foldForQueryId(testCase.queryId, folds) === fold);
    const model = trainBoostedTreeRanker(trainCases, rowsByQueryId, options);
    const rankedTestCases = rerankCasesWithBoostedTreeModel(testCases, rowsByQueryId, model, options.retrieveSize);
    const testEvaluation = evaluateRun(rankedTestCases, options.k || 10, { relevanceMode: options.relevanceMode || "graded" });
    foldRuns.push({
      fold,
      trainQueryCount: trainCases.length,
      testQueryCount: testCases.length,
      testMetrics: {
        map: testEvaluation.aggregate.averagePrecision,
        ndcgAtK: testEvaluation.aggregate.ndcgAtK,
        precisionAtK: testEvaluation.aggregate.precisionAtK,
        recallAtK: testEvaluation.aggregate.recallAtK,
        mrr: testEvaluation.aggregate.reciprocalRank
      },
      modelSummary: {
        modelType: model.modelType,
        baseScore: model.baseScore,
        learningRate: model.learningRate,
        treeCount: model.treeCount,
        maxDepth: model.maxDepth,
        minLeafSize: model.minLeafSize
      }
    });
    heldoutCases.push(...rankedTestCases);
  }

  const originalOrder = new Map(cases.map((testCase, index) => [String(testCase.queryId), index]));
  heldoutCases.sort((a, b) => originalOrder.get(String(a.queryId)) - originalOrder.get(String(b.queryId)));
  const evaluation = evaluateRun(heldoutCases, options.k || 10, { relevanceMode: options.relevanceMode || "graded" });

  return {
    folds,
    metrics: {
      map: evaluation.aggregate.averagePrecision,
      ndcgAtK: evaluation.aggregate.ndcgAtK,
      precisionAtK: evaluation.aggregate.precisionAtK,
      recallAtK: evaluation.aggregate.recallAtK,
      mrr: evaluation.aggregate.reciprocalRank
    },
    evaluation,
    foldRuns
  };
}
