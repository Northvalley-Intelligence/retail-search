import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildFeatureRowsByQuery,
  candidatePoolRecall,
  crossValidateBoostedTrees,
  crossValidate,
  rankRows,
  significantTokens,
  trainBoostedTreeRanker,
  trainCoordinateAscent
} from "../src/evaluation/ltr.js";

const CASES = [
  {
    queryId: "1",
    query: "heated aircraft similarity laws",
    qrels: {
      relevant: 4
    },
    results: [
      {
        id: "noise",
        score: 10,
        title: "aircraft index",
        abstract: "general notes"
      },
      {
        id: "relevant",
        score: 8,
        title: "similarity laws for heated aircraft",
        abstract: "aeroelastic model laws for high speed aircraft"
      }
    ]
  },
  {
    queryId: "2",
    query: "boundary layer transition",
    qrels: {
      relevant2: 3
    },
    results: [
      {
        id: "noise2",
        score: 7,
        title: "transition notes",
        abstract: "unrelated overview"
      },
      {
        id: "relevant2",
        score: 6,
        title: "boundary layer transition",
        abstract: "transition in boundary layers"
      }
    ]
  }
];

test("significantTokens removes generic words while preserving query terms", () => {
  assert.deepEqual(significantTokens("what are the heated aircraft laws?"), ["heated", "aircraft", "laws"]);
});

test("LTR feature rows expose coverage and lexical features", () => {
  const rowsByQuery = buildFeatureRowsByQuery(CASES);
  const rows = rowsByQuery.get("1");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].features.lexicalScore, 1);
  assert.ok(rows[1].features.titleCoverage > rows[0].features.titleCoverage);
  assert.equal(rows[1].label, 4);
});

test("rankRows can promote a lower BM25 result using learned coverage features", () => {
  const rowsByQuery = buildFeatureRowsByQuery(CASES);
  const ranked = rankRows(rowsByQuery.get("1"), {
    lexicalScore: 0,
    titleCoverage: 2,
    abstractCoverage: 1
  });
  assert.equal(ranked[0].id, "relevant");
});

test("coordinate-ascent LTR trains and cross-validates by query", () => {
  const rowsByQuery = buildFeatureRowsByQuery(CASES);
  const model = trainCoordinateAscent(CASES, rowsByQuery, {
    k: 1,
    folds: 2,
    stepSizes: [1, 0.5],
    maxPassesPerStep: 2
  });
  assert.equal(model.trainMetric, 1);
  assert.ok(Object.entries(model.weights).some(([name, value]) => name !== "lexicalScore" && value !== 0));

  const cv = crossValidate(CASES, rowsByQuery, {
    k: 1,
    folds: 2,
    stepSizes: [1],
    maxPassesPerStep: 1
  });
  assert.equal(cv.foldRuns.length, 2);
  assert.equal(cv.evaluation.queryCount, 2);
});

test("boosted-tree LTR trains and cross-validates by query", () => {
  const rowsByQuery = buildFeatureRowsByQuery(CASES);
  const model = trainBoostedTreeRanker(CASES, rowsByQuery, {
    treeCount: 4,
    learningRate: 0.1,
    maxDepth: 2,
    minLeafSize: 1,
    maxThresholds: 4
  });
  assert.equal(model.modelType, "pointwise-gradient-boosted-regression-trees");
  assert.equal(model.trees.length, 4);

  const cv = crossValidateBoostedTrees(CASES, rowsByQuery, {
    k: 1,
    folds: 2,
    treeCount: 2,
    learningRate: 0.1,
    maxDepth: 2,
    minLeafSize: 1,
    maxThresholds: 4
  });
  assert.equal(cv.foldRuns.length, 2);
  assert.equal(cv.evaluation.queryCount, 2);
});

test("candidatePoolRecall measures whether relevant documents are retrievable", () => {
  assert.deepEqual(candidatePoolRecall(CASES), {
    relevantCount: 2,
    relevantInPool: 2,
    recall: 1,
    queriesWithRelevant: 2,
    queriesWithRelevantInPool: 2,
    queryCoverage: 1
  });
});
