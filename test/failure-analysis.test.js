import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeFailureBehavior } from "../src/evaluation/failure-analysis.js";
import { evaluateRun } from "../src/evaluation/metrics.js";

test("groups Cranfield failures by observed retrieval behavior", () => {
  const cases = [
    {
      queryId: "zero",
      query: "transonic aileron buzz mechanism",
      qrels: { "64": 2, "65": 4 },
      results: [{ id: "496" }, { id: "313" }]
    },
    {
      queryId: "late",
      query: "shock sound interaction",
      qrels: { "64": 1, "65": 4 },
      results: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "65" }]
    },
    {
      queryId: "broad",
      query: "heated high speed aircraft models",
      qrels: Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`rel-${index + 1}`, 3])),
      results: [{ id: "rel-1" }, { id: "noise-1" }, { id: "noise-2" }, { id: "noise-3" }]
    }
  ];
  const evaluation = evaluateRun(cases, 4);
  const analysis = analyzeFailureBehavior(cases, evaluation.perQuery, {
    k: 4,
    includePerQuery: true
  });

  assert.equal(analysis.groups.reduce((sum, group) => sum + group.queryCount, 0), 3);
  assert.ok(analysis.groups.some((group) => group.id === "zero_relevant_at_k" && group.queryCount === 1));
  assert.ok(analysis.groups.some((group) => group.id === "late_first_relevant" && group.queryCount === 1));
  assert.ok(analysis.groups.some((group) => group.id === "broad_need_low_recall" && group.queryCount === 1));
  assert.equal(analysis.perQuery.find((query) => query.queryId === "zero").firstRelevantRank, null);
  assert.deepEqual(analysis.perQuery.find((query) => query.queryId === "late").relevantRetrievedIdsAtK, ["65"]);
});
