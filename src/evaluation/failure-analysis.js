const DEFAULT_EXAMPLE_LIMIT = 5;

export const FAILURE_BEHAVIOR_GROUPS = {
  zero_relevant_at_k: {
    label: "No relevant result in top K",
    description: "The query retrieved results, but none of the top K results are judged relevant."
  },
  late_first_relevant: {
    label: "Relevant result ranked too late",
    description: "A relevant document appears in the top K, but below the first three positions."
  },
  broad_need_low_recall: {
    label: "Broad information need with low recall",
    description: "The query has many relevant judgments, but the top K captures only a small fraction."
  },
  lexical_noise_low_precision: {
    label: "Lexical noise dominates",
    description: "The query finds at least one relevant document, but most top K results are non-relevant."
  },
  graded_ranking_loss: {
    label: "Relevant results found but weak graded ranking",
    description: "Some relevant documents are found, but graded relevance remains low."
  },
  partial_recall: {
    label: "Partial recall",
    description: "The query has relevant hits, but leaves most judged relevant documents outside top K."
  },
  passing_or_minor: {
    label: "Passing or minor issue",
    description: "The top K behavior is not currently classified as a meaningful failure."
  }
};

function resultId(result) {
  return typeof result === "string" ? result : result.id;
}

function positiveRelevantEntries(qrels = {}) {
  return Object.entries(qrels)
    .filter(([, grade]) => Number(grade) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]));
}

function roundMetric(value) {
  return Math.round(value * 10000) / 10000;
}

function classifyBehavior({ metrics, relevantCount, hitCountAtK, firstRelevantRank }) {
  if (hitCountAtK === 0) {
    return "zero_relevant_at_k";
  }

  if (firstRelevantRank > 3) {
    return "late_first_relevant";
  }

  if (relevantCount >= 10 && metrics.recallAtK < 0.35) {
    return "broad_need_low_recall";
  }

  if (metrics.precisionAtK < 0.2) {
    return "lexical_noise_low_precision";
  }

  if (metrics.ndcgAtK < 0.25) {
    return "graded_ranking_loss";
  }

  if (metrics.recallAtK < 0.5) {
    return "partial_recall";
  }

  return "passing_or_minor";
}

function queryAnalysis(testCase, metrics, k) {
  const relevantEntries = positiveRelevantEntries(testCase.qrels);
  const relevantSet = new Set(relevantEntries.map(([id]) => id));
  const topResults = (testCase.results || []).slice(0, k);
  const retrievedIdsAtK = topResults.map(resultId);
  const relevantRetrievedIdsAtK = retrievedIdsAtK.filter((id) => relevantSet.has(id));
  const firstRelevantIndex = retrievedIdsAtK.findIndex((id) => relevantSet.has(id));
  const firstRelevantRank = firstRelevantIndex === -1 ? null : firstRelevantIndex + 1;
  const missingRelevantIdsAtK = relevantEntries
    .filter(([id]) => !relevantRetrievedIdsAtK.includes(id))
    .map(([id, grade]) => ({ id, grade: Number(grade) }));
  const topNonRelevantIdsAtK = retrievedIdsAtK.filter((id) => !relevantSet.has(id));
  const behaviorGroup = classifyBehavior({
    metrics,
    relevantCount: relevantEntries.length,
    hitCountAtK: relevantRetrievedIdsAtK.length,
    firstRelevantRank
  });

  return {
    queryId: testCase.queryId,
    query: testCase.query,
    behaviorGroup,
    behaviorLabel: FAILURE_BEHAVIOR_GROUPS[behaviorGroup].label,
    metrics,
    relevantCount: relevantEntries.length,
    hitCountAtK: relevantRetrievedIdsAtK.length,
    firstRelevantRank,
    retrievedIdsAtK,
    relevantRetrievedIdsAtK,
    topNonRelevantIdsAtK,
    missingRelevantIdsAtK: missingRelevantIdsAtK.slice(0, 12)
  };
}

function summarizeGroup(groupId, queries) {
  const totals = queries.reduce(
    (aggregate, query) => {
      for (const [name, value] of Object.entries(query.metrics)) {
        aggregate[name] += value;
      }
      aggregate.relevantCount += query.relevantCount;
      aggregate.hitCountAtK += query.hitCountAtK;
      return aggregate;
    },
    {
      precisionAtK: 0,
      recallAtK: 0,
      averagePrecision: 0,
      reciprocalRank: 0,
      ndcgAtK: 0,
      relevantCount: 0,
      hitCountAtK: 0
    }
  );
  const count = queries.length || 1;

  return {
    id: groupId,
    label: FAILURE_BEHAVIOR_GROUPS[groupId].label,
    description: FAILURE_BEHAVIOR_GROUPS[groupId].description,
    queryCount: queries.length,
    averageMetrics: {
      precisionAtK: roundMetric(totals.precisionAtK / count),
      recallAtK: roundMetric(totals.recallAtK / count),
      averagePrecision: roundMetric(totals.averagePrecision / count),
      reciprocalRank: roundMetric(totals.reciprocalRank / count),
      ndcgAtK: roundMetric(totals.ndcgAtK / count)
    },
    averageRelevantCount: roundMetric(totals.relevantCount / count),
    averageRelevantHitsAtK: roundMetric(totals.hitCountAtK / count)
  };
}

export function analyzeFailureBehavior(cases, perQueryMetrics, options = {}) {
  const k = options.k || 10;
  const exampleLimit = options.exampleLimit || DEFAULT_EXAMPLE_LIMIT;
  const metricsByQueryId = new Map(perQueryMetrics.map((query) => [query.queryId, query.metrics]));
  const perQuery = cases.map((testCase) => queryAnalysis(testCase, metricsByQueryId.get(testCase.queryId), k));
  const grouped = new Map();

  for (const query of perQuery) {
    if (!grouped.has(query.behaviorGroup)) {
      grouped.set(query.behaviorGroup, []);
    }
    grouped.get(query.behaviorGroup).push(query);
  }

  const groups = Array.from(grouped.entries())
    .map(([groupId, queries]) => summarizeGroup(groupId, queries))
    .sort((a, b) => b.queryCount - a.queryCount || a.id.localeCompare(b.id));

  const examplesByGroup = Object.fromEntries(
    Array.from(grouped.entries()).map(([groupId, queries]) => [
      groupId,
      queries
        .slice()
        .sort((a, b) => a.metrics.ndcgAtK - b.metrics.ndcgAtK || a.queryId.localeCompare(b.queryId))
        .slice(0, exampleLimit)
    ])
  );

  return {
    k,
    groupCount: groups.length,
    groups,
    examplesByGroup,
    perQuery: options.includePerQuery ? perQuery : undefined
  };
}
