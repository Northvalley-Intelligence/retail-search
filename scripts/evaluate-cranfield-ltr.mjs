import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { evaluateRun } from "../src/evaluation/metrics.js";
import {
  buildFeatureRowsByQuery,
  candidatePoolRecall,
  crossValidateBoostedTrees,
  crossValidate,
  evaluateBoostedTreeModel,
  evaluateWeights,
  oracleCases,
  rerankCases,
  rerankCasesWithBoostedTreeModel,
  trainBoostedTreeRanker,
  trainCoordinateAscent
} from "../src/evaluation/ltr.js";

const DEFAULT_RETRIEVAL_CACHE = "experiments/cranfield-v0/retrieval-pools-field-sum-top50-gen017.json";

function parseArgs(argv) {
  const args = {
    retrievalCache: DEFAULT_RETRIEVAL_CACHE,
    embeddings: null,
    write: null,
    k: 10,
    relevanceMode: "graded",
    folds: 5,
    model: "coordinate-ascent",
    treeCount: 80,
    learningRate: 0.05,
    maxDepth: 3,
    minLeafSize: 12,
    maxThresholds: 16,
    retrieveSize: null,
    summary: false,
    details: false,
    top: 12
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--retrieval-cache") {
      args.retrievalCache = argv[index + 1];
      index += 1;
    } else if (value === "--embeddings") {
      args.embeddings = argv[index + 1];
      index += 1;
    } else if (value === "--write") {
      args.write = argv[index + 1];
      index += 1;
    } else if (value === "--k") {
      args.k = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--relevance-mode") {
      args.relevanceMode = argv[index + 1];
      index += 1;
    } else if (value === "--folds") {
      args.folds = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--model") {
      args.model = argv[index + 1];
      index += 1;
    } else if (value === "--tree-count") {
      args.treeCount = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--learning-rate") {
      args.learningRate = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--max-depth") {
      args.maxDepth = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--min-leaf-size") {
      args.minLeafSize = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--max-thresholds") {
      args.maxThresholds = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--retrieve-size") {
      args.retrieveSize = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--summary") {
      args.summary = true;
    } else if (value === "--details") {
      args.details = true;
    } else if (value === "--top") {
      args.top = Number(argv[index + 1]);
      index += 1;
    }
  }

  if (!["graded", "binary", "linear", "cranfield-reversed"].includes(args.relevanceMode)) {
    throw new Error("--relevance-mode must be graded, binary, linear, or cranfield-reversed");
  }
  if (!["coordinate-ascent", "boosted-trees"].includes(args.model)) {
    throw new Error("--model must be coordinate-ascent or boosted-trees");
  }
  return args;
}

function mapById(rows = []) {
  return new Map(rows.map((row) => [String(row.id), row]));
}

async function readEmbeddingContext(path) {
  if (!path) {
    return null;
  }
  const embeddings = JSON.parse(await readFile(path, "utf8"));
  return {
    source: path,
    provider: embeddings.provider,
    model: embeddings.model,
    dimension: embeddings.dimension,
    documentEmbeddingsById: mapById(embeddings.documents),
    queryEmbeddingsById: mapById(embeddings.queries)
  };
}

function metricsFromEvaluation(evaluation) {
  return {
    map: evaluation.aggregate.averagePrecision,
    ndcgAtK: evaluation.aggregate.ndcgAtK,
    precisionAtK: evaluation.aggregate.precisionAtK,
    recallAtK: evaluation.aggregate.recallAtK,
    mrr: evaluation.aggregate.reciprocalRank
  };
}

function averageWeights(foldRuns) {
  const totals = new Map();
  for (const fold of foldRuns) {
    for (const [featureName, value] of Object.entries(fold.weights)) {
      totals.set(featureName, (totals.get(featureName) || 0) + Number(value || 0));
    }
  }
  return Object.fromEntries(Array.from(totals.entries()).map(([featureName, total]) => [featureName, Math.round((total / foldRuns.length) * 10000) / 10000]));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cache = JSON.parse(await readFile(args.retrievalCache, "utf8"));
  if (!Array.isArray(cache.cases)) {
    throw new Error(`${args.retrievalCache} does not include a cases array`);
  }

  const cases = cache.cases.map((testCase) => ({
    ...testCase,
    results: args.retrieveSize ? testCase.results.slice(0, args.retrieveSize) : testCase.results
  }));
  const retrieveSize = args.retrieveSize || cache.retrieveSize || cases[0]?.results?.length || 50;
  const embeddingContext = await readEmbeddingContext(args.embeddings);
  const rowsByQueryId = buildFeatureRowsByQuery(cases, { embeddingContext });
  const fieldSumEvaluation = evaluateRun(cases, args.k, { relevanceMode: args.relevanceMode });
  const oracleEvaluation = evaluateRun(oracleCases(cases, retrieveSize), args.k, { relevanceMode: args.relevanceMode });
  const modelOptions = {
    k: args.k,
    relevanceMode: args.relevanceMode,
    retrieveSize,
    folds: args.folds,
    treeCount: args.treeCount,
    learningRate: args.learningRate,
    maxDepth: args.maxDepth,
    minLeafSize: args.minLeafSize,
    maxThresholds: args.maxThresholds
  };
  const crossValidation =
    args.model === "boosted-trees" ? crossValidateBoostedTrees(cases, rowsByQueryId, modelOptions) : crossValidate(cases, rowsByQueryId, modelOptions);
  const allQueryModel =
    args.model === "boosted-trees" ? trainBoostedTreeRanker(cases, rowsByQueryId, modelOptions) : trainCoordinateAscent(cases, rowsByQueryId, modelOptions);
  const allQueryEvaluation =
    args.model === "boosted-trees"
      ? evaluateBoostedTreeModel(cases, rowsByQueryId, allQueryModel, modelOptions)
      : evaluateWeights(cases, rowsByQueryId, allQueryModel.weights, modelOptions);
  const rankedCases =
    args.details && args.model === "boosted-trees"
      ? rerankCasesWithBoostedTreeModel(cases, rowsByQueryId, allQueryModel, retrieveSize)
      : args.details
        ? rerankCases(cases, rowsByQueryId, allQueryModel.weights, retrieveSize)
        : undefined;

  const output = {
    generatedAt: new Date().toISOString(),
    dataset: "cranfield",
    transport: "offline-ltr-evaluator",
    retrievalCache: args.retrievalCache,
    sourceArchitecture: cache.searchArchitecture?.id || "field-sum",
    embeddingSource: args.embeddings,
    embeddingProvider: embeddingContext?.provider || null,
    embeddingModel: embeddingContext?.model || null,
    embeddingDimension: embeddingContext?.dimension || null,
    k: args.k,
    relevanceMode: args.relevanceMode,
    ltrModel: args.model,
    modelOptions:
      args.model === "boosted-trees"
        ? {
            treeCount: args.treeCount,
            learningRate: args.learningRate,
            maxDepth: args.maxDepth,
            minLeafSize: args.minLeafSize,
            maxThresholds: args.maxThresholds
          }
        : {
            type: "coordinate-ascent"
          },
    retrieveSize,
    queryCount: cases.length,
    folds: args.folds,
    currentBestReference:
      args.relevanceMode === "binary" && args.k === 20
        ? {
            architecture: "ARCH-0.2-candidate refined prf-rerank",
            metric: "nDCG@20",
            value: 0.4563
          }
        : {
            architecture: "ARCH-0.2-candidate refined prf-rerank",
            metric: "nDCG@10",
            value: 0.326
          },
    candidatePool: {
      ...candidatePoolRecall(cases),
      oracleMetrics: metricsFromEvaluation(oracleEvaluation)
    },
    fieldSum: {
      metrics: metricsFromEvaluation(fieldSumEvaluation)
    },
    crossValidation: {
      metrics: crossValidation.metrics,
      averageWeights: args.model === "coordinate-ascent" ? averageWeights(crossValidation.foldRuns) : null,
      foldRuns: crossValidation.foldRuns
    },
    allQueryModel: {
      warning: "In-sample training result; use crossValidation for promotion decisions.",
      metrics: metricsFromEvaluation(allQueryEvaluation),
      model:
        args.model === "boosted-trees"
          ? {
              modelType: allQueryModel.modelType,
              baseScore: allQueryModel.baseScore,
              learningRate: allQueryModel.learningRate,
              treeCount: allQueryModel.treeCount,
              maxDepth: allQueryModel.maxDepth,
              minLeafSize: allQueryModel.minLeafSize,
              maxThresholds: allQueryModel.maxThresholds
            }
          : undefined,
      weights: args.model === "coordinate-ascent" ? allQueryModel.weights : undefined,
      trainMetric: allQueryModel.trainMetric,
      history: allQueryModel.history.slice(0, 50),
      fullModel: args.model === "boosted-trees" ? allQueryModel : undefined
    },
    cases: rankedCases
  };

  if (args.write) {
    await mkdir(dirname(args.write), { recursive: true });
    await writeFile(args.write, `${JSON.stringify(output, null, 2)}\n`);
  }

  const summary = {
    ...output,
    cases: undefined,
    crossValidation: {
      ...output.crossValidation,
      foldRuns: output.crossValidation.foldRuns.map((fold) => ({
        fold: fold.fold,
        trainQueryCount: fold.trainQueryCount,
        testQueryCount: fold.testQueryCount,
        trainNdcgAtK: fold.trainNdcgAtK,
        testMetrics: fold.testMetrics,
        weights: fold.weights
      }))
    },
    allQueryModel: {
      ...output.allQueryModel,
      history: output.allQueryModel.history.slice(0, args.top),
      fullModel: undefined
    }
  };

  console.log(JSON.stringify(args.summary ? summary : output, null, 2));
}

main().catch((error) => {
  console.log(
    JSON.stringify(
      {
        status: "blocked",
        reason: "cranfield_ltr_evaluation_failed",
        errorCode: error.cause?.code || error.code || null,
        message: error.message,
        valuesPrinted: false
      },
      null,
      2
    )
  );
  process.exit(1);
});
