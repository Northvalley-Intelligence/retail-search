import assert from "node:assert/strict";
import { test } from "node:test";
import { averagePrecision, evaluateRun, ndcgAtK, precisionAtK, recallAtK, reciprocalRank } from "../src/evaluation/metrics.js";

const qrels = {
  "doc-1": 3,
  "doc-2": 2,
  "doc-3": 0
};

test("computes core relevance metrics for ranked search results", () => {
  const results = ["doc-4", "doc-1", "doc-2"];

  assert.equal(precisionAtK(results, qrels, 3), 2 / 3);
  assert.equal(recallAtK(results, qrels, 3), 1);
  assert.equal(averagePrecision(results, qrels, 3), (1 / 2 + 2 / 3) / 2);
  assert.equal(reciprocalRank(results, qrels, 3), 1 / 2);
  assert.ok(ndcgAtK(results, qrels, 3) > 0);
});

test("aggregates MAP, nDCG, precision, recall, and MRR style metrics", () => {
  const run = evaluateRun(
    [
      {
        queryId: "q1",
        query: "wing",
        qrels,
        results: ["doc-1", "doc-2"]
      },
      {
        queryId: "q2",
        query: "heat",
        qrels: { "doc-9": 1 },
        results: ["doc-8", "doc-9"]
      }
    ],
    10
  );

  assert.equal(run.queryCount, 2);
  assert.equal(run.perQuery.length, 2);
  assert.ok(run.aggregate.averagePrecision > 0);
  assert.ok(run.aggregate.reciprocalRank > 0);
});

