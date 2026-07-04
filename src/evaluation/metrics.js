function relevantIds(qrels) {
  return Object.entries(qrels)
    .filter(([, grade]) => Number(grade) > 0)
    .map(([id]) => id);
}

function resultIds(results) {
  return results.map((result) => (typeof result === "string" ? result : result.id));
}

export function precisionAtK(results, qrels, k = 10) {
  const ids = resultIds(results).slice(0, k);
  if (ids.length === 0) {
    return 0;
  }
  const relevant = new Set(relevantIds(qrels));
  const hits = ids.filter((id) => relevant.has(id)).length;
  return hits / ids.length;
}

export function recallAtK(results, qrels, k = 10) {
  const relevant = new Set(relevantIds(qrels));
  if (relevant.size === 0) {
    return 0;
  }
  const ids = resultIds(results).slice(0, k);
  const hits = ids.filter((id) => relevant.has(id)).length;
  return hits / relevant.size;
}

export function averagePrecision(results, qrels, k = 10) {
  const relevant = new Set(relevantIds(qrels));
  if (relevant.size === 0) {
    return 0;
  }

  let hits = 0;
  let precisionSum = 0;
  resultIds(results)
    .slice(0, k)
    .forEach((id, index) => {
      if (relevant.has(id)) {
        hits += 1;
        precisionSum += hits / (index + 1);
      }
    });

  return precisionSum / relevant.size;
}

export function reciprocalRank(results, qrels, k = 10) {
  const relevant = new Set(relevantIds(qrels));
  const ids = resultIds(results).slice(0, k);
  const index = ids.findIndex((id) => relevant.has(id));
  return index === -1 ? 0 : 1 / (index + 1);
}

export function dcg(results, qrels, k = 10) {
  return resultIds(results)
    .slice(0, k)
    .reduce((sum, id, index) => {
      const grade = Number(qrels[id] || 0);
      if (grade <= 0) {
        return sum;
      }
      return sum + (2 ** grade - 1) / Math.log2(index + 2);
    }, 0);
}

export function ndcgAtK(results, qrels, k = 10) {
  const ideal = Object.entries(qrels)
    .filter(([, grade]) => Number(grade) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([id]) => id);
  const idealDcg = dcg(ideal, qrels, k);
  if (idealDcg === 0) {
    return 0;
  }
  return dcg(results, qrels, k) / idealDcg;
}

function roundMetric(value) {
  return Math.round(value * 10000) / 10000;
}

export function evaluateRun(cases, k = 10) {
  const perQuery = cases.map((testCase) => {
    const metrics = {
      precisionAtK: roundMetric(precisionAtK(testCase.results, testCase.qrels, k)),
      recallAtK: roundMetric(recallAtK(testCase.results, testCase.qrels, k)),
      averagePrecision: roundMetric(averagePrecision(testCase.results, testCase.qrels, k)),
      reciprocalRank: roundMetric(reciprocalRank(testCase.results, testCase.qrels, k)),
      ndcgAtK: roundMetric(ndcgAtK(testCase.results, testCase.qrels, k))
    };
    return {
      queryId: testCase.queryId,
      query: testCase.query,
      metrics
    };
  });

  const aggregate = perQuery.reduce(
    (totals, query) => {
      for (const [name, value] of Object.entries(query.metrics)) {
        totals[name] += value;
      }
      return totals;
    },
    {
      precisionAtK: 0,
      recallAtK: 0,
      averagePrecision: 0,
      reciprocalRank: 0,
      ndcgAtK: 0
    }
  );

  const count = perQuery.length || 1;
  return {
    k,
    queryCount: perQuery.length,
    aggregate: Object.fromEntries(Object.entries(aggregate).map(([name, value]) => [name, roundMetric(value / count)])),
    perQuery
  };
}

