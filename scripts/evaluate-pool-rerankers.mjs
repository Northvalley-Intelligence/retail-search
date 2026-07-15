// Offline technique evaluation from cached retrieval pools (M-0002.3).
// Applies Phase 1 rerank techniques to a pool cache and scores them without
// touching OpenSearch — the GEN-017 fast loop generalized to any dataset.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { evaluateRun } from "../src/evaluation/metrics.js";
import { rerankByCoverage, rerankByPseudoRelevanceFeedback } from "../src/evaluation/rerankers.js";

function parseArgs(argv) {
  const args = { pool: null, technique: null, k: 10, write: null, bodyField: "text", relevanceMode: "linear" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--pool") {
      args.pool = argv[index + 1];
      index += 1;
    } else if (value === "--technique") {
      args.technique = argv[index + 1];
      index += 1;
    } else if (value === "--k") {
      args.k = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--write") {
      args.write = argv[index + 1];
      index += 1;
    } else if (value === "--body-field") {
      args.bodyField = argv[index + 1];
      index += 1;
    } else if (value === "--relevance-mode") {
      args.relevanceMode = argv[index + 1];
      index += 1;
    }
  }
  if (!args.pool || !args.technique) {
    throw new Error("--pool and --technique are required (technique: first-stage, coverage-rerank, prf-rerank)");
  }
  if (!["first-stage", "coverage-rerank", "prf-rerank"].includes(args.technique)) {
    throw new Error("--technique must be first-stage, coverage-rerank, or prf-rerank");
  }
  return args;
}

function applyTechnique(technique, query, results, bodyField) {
  if (technique === "first-stage") {
    return results;
  }
  if (technique === "coverage-rerank") {
    return rerankByCoverage(query, results, { bodyField });
  }
  return rerankByPseudoRelevanceFeedback(query, results, { bodyField }).results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pool = JSON.parse(await readFile(args.pool, "utf8"));

  const cases = pool.cases.map((poolCase) => ({
    queryId: poolCase.queryId,
    query: poolCase.query,
    qrels: poolCase.qrels,
    results: applyTechnique(args.technique, poolCase.query, poolCase.results, args.bodyField).slice(0, args.k)
  }));

  const evaluation = evaluateRun(cases, args.k, { relevanceMode: args.relevanceMode });
  const output = {
    generatedAt: "2026-07-15T00:00:00.000Z",
    dataset: pool.dataset,
    technique: args.technique,
    transport: "offline-pool-cache",
    poolSource: args.pool,
    firstStage: pool.firstStage || pool.architectureVersion || null,
    retrieveSize: pool.retrieveSize,
    bodyField: args.bodyField,
    metrics: {
      map: evaluation.aggregate.averagePrecision,
      ndcgAtK: evaluation.aggregate.ndcgAtK,
      precisionAtK: evaluation.aggregate.precisionAtK,
      recallAtK: evaluation.aggregate.recallAtK,
      mrr: evaluation.aggregate.reciprocalRank
    },
    evaluation
  };

  if (args.write) {
    await mkdir(dirname(args.write), { recursive: true });
    await writeFile(args.write, `${JSON.stringify(output, null, 2)}\n`);
  }

  console.log(
    JSON.stringify(
      {
        dataset: output.dataset,
        technique: output.technique,
        bodyField: args.bodyField,
        relevanceMode: evaluation.relevanceMode,
        queryCount: evaluation.queryCount,
        k: evaluation.k,
        metrics: output.metrics,
        wrote: args.write || null
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.log(JSON.stringify({ status: "blocked", reason: "pool_reranker_evaluation_failed", message: error.message }, null, 2));
  process.exit(1);
});
