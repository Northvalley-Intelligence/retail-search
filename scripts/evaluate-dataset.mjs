import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { analyzeFailureBehavior } from "../src/evaluation/failure-analysis.js";
import { evaluateRun } from "../src/evaluation/metrics.js";
import { loadEvaluationCases, resolveDataset, searchDataset } from "./lib/datasets.mjs";
import { mergedEnv } from "./lib/local-env.mjs";

function parseArgs(argv) {
  const args = {
    dataset: null,
    k: 10,
    retrieveSize: null,
    write: null,
    queries: null,
    index: null,
    architecture: null,
    concurrency: 5,
    summary: false,
    details: false,
    relevanceMode: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--dataset") {
      args.dataset = argv[index + 1];
      index += 1;
    } else if (value === "--k") {
      args.k = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--retrieve-size") {
      args.retrieveSize = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--write") {
      args.write = argv[index + 1];
      index += 1;
    } else if (value === "--queries") {
      args.queries = argv[index + 1];
      index += 1;
    } else if (value === "--index") {
      args.index = argv[index + 1];
      index += 1;
    } else if (value === "--architecture") {
      args.architecture = argv[index + 1];
      index += 1;
    } else if (value === "--concurrency") {
      args.concurrency = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--summary") {
      args.summary = true;
    } else if (value === "--details") {
      args.details = true;
    } else if (value === "--relevance-mode") {
      args.relevanceMode = argv[index + 1];
      index += 1;
    } else if (value === "--include-identical-ids") {
      args.includeIdenticalIds = true;
    }
  }
  if (!args.dataset) {
    throw new Error("--dataset is required, e.g. --dataset beir/scifact or --dataset cranfield");
  }
  return args;
}

function envFromProcess() {
  const env = mergedEnv();
  return {
    OPENSEARCH_URL: env.OPENSEARCH_URL,
    OPENSEARCH_API_KEY: env.OPENSEARCH_API_KEY,
    OPENSEARCH_USERNAME: env.OPENSEARCH_USERNAME,
    OPENSEARCH_PASSWORD: env.OPENSEARCH_PASSWORD,
    CRANFIELD_INDEX: env.CRANFIELD_INDEX,
    ARCHITECTURE_VERSION: env.ARCHITECTURE_VERSION
  };
}

async function runLiveEvaluation({ dataset, queries, size, env, index, architecture, concurrency }) {
  const results = new Array(queries.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(Number(concurrency) || 1, queries.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < queries.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const query = queries[currentIndex];
      const searchResults = await searchDataset({
        dataset,
        query: query.query,
        size: dataset.ignoreIdenticalIds ? size + 1 : size,
        env,
        index,
        architecture
      });
      const filteredResults = dataset.ignoreIdenticalIds
        ? searchResults.filter((result) => result.id !== query.id).slice(0, size)
        : searchResults;
      results[currentIndex] = {
        queryId: query.id,
        query: query.query,
        qrels: query.qrels,
        results: filteredResults
      };
    }
  });
  await Promise.all(workers);
  return results;
}

function referenceComparison(dataset, measuredNdcgAtK, k) {
  if (dataset.publishedBm25NdcgAt10 === null || k !== 10) {
    return null;
  }
  const published = dataset.publishedBm25NdcgAt10;
  const delta = Math.round((measuredNdcgAtK - published) * 10000) / 10000;
  return {
    metric: "ndcgAt10",
    published,
    measured: measuredNdcgAtK,
    delta,
    relativeDelta: Math.round((delta / published) * 10000) / 10000,
    source: "BEIR published BM25 baseline (see Mission Update 002 reference table)"
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dataset = resolveDataset(args.dataset);
  const relevanceMode = args.relevanceMode || dataset.relevanceMode;
  if (!["graded", "binary", "linear", "cranfield-reversed"].includes(relevanceMode)) {
    throw new Error("--relevance-mode must be graded, binary, linear, or cranfield-reversed");
  }

  const queries = await loadEvaluationCases(dataset, { queriesPath: args.queries });
  const effectiveDataset = args.includeIdenticalIds ? { ...dataset, ignoreIdenticalIds: false } : dataset;
  const retrieveSize = args.retrieveSize || args.k;
  const env = envFromProcess();
  const cases = await runLiveEvaluation({
    dataset: effectiveDataset,
    queries,
    size: retrieveSize,
    env,
    index: args.index,
    architecture: args.architecture,
    concurrency: args.concurrency
  });

  const evaluation = evaluateRun(cases, args.k, { relevanceMode });
  const failureAnalysis = analyzeFailureBehavior(cases, evaluation.perQuery, {
    k: args.k,
    includePerQuery: args.details,
    exampleLimit: 5
  });

  const output = {
    generatedAt: "2026-07-14T00:00:00.000Z",
    dataset: dataset.id,
    datasetTier: dataset.tier,
    harness: "dataset-agnostic-v1",
    technique: dataset.family === "cranfield" ? args.architecture || "default" : "bm25-multi-match",
    transport: "live-opensearch",
    index: args.index || dataset.defaultIndex,
    retrieveSize,
    metrics: {
      map: evaluation.aggregate.averagePrecision,
      ndcgAtK: evaluation.aggregate.ndcgAtK,
      precisionAtK: evaluation.aggregate.precisionAtK,
      recallAtK: evaluation.aggregate.recallAtK,
      mrr: evaluation.aggregate.reciprocalRank
    },
    referenceComparison: referenceComparison(dataset, evaluation.aggregate.ndcgAtK, args.k),
    evaluation,
    failureAnalysis
  };

  if (args.write) {
    await mkdir(dirname(args.write), { recursive: true });
    await writeFile(args.write, `${JSON.stringify(output, null, 2)}\n`);
  }

  console.log(
    JSON.stringify(
      args.summary
        ? {
            dataset: output.dataset,
            technique: output.technique,
            transport: output.transport,
            index: output.index,
            queryCount: evaluation.queryCount,
            k: evaluation.k,
            relevanceMode: evaluation.relevanceMode,
            retrieveSize,
            metrics: output.metrics,
            referenceComparison: output.referenceComparison,
            failureGroups: failureAnalysis.groups,
            wrote: args.write || null
          }
        : output,
      null,
      2
    )
  );
}

main().catch((error) => {
  console.log(
    JSON.stringify(
      {
        status: "blocked",
        reason: "dataset_evaluation_failed",
        errorCode: error.cause?.code || error.code || null,
        message: error.message.replace(/https?:\/\/\S+/gu, "<redacted-url>"),
        valuesPrinted: false
      },
      null,
      2
    )
  );
  process.exit(1);
});
