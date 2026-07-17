// Generic LTR column (M-0002.3). Runs the Phase 1 learning-to-rank pipeline
// (coordinate-ascent / boosted trees, query-grouped cross-validation) with BGE
// features over a BEIR pool, and compares cross-validated LTR against plain BGE
// hybrid to answer the Occam question: does LTR complexity beat plain hybrid?
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { evaluateRun } from "../src/evaluation/metrics.js";
import {
  buildFeatureRowsByQuery,
  crossValidate,
  crossValidateBoostedTrees
} from "../src/evaluation/ltr.js";

function parseArgs(argv) {
  const a = { pool: null, embeddings: null, bgeHybrid: null, write: null, k: 10, folds: 5, model: "boosted-trees", relevanceMode: "linear", treeCount: 60, learningRate: 0.1, maxDepth: 3, minLeafSize: 3, maxThresholds: 16 };
  for (let i = 0; i < argv.length; i += 1) {
    const v = argv[i];
    if (v === "--pool") a.pool = argv[++i];
    else if (v === "--embeddings") a.embeddings = argv[++i];
    else if (v === "--bge-hybrid") a.bgeHybrid = argv[++i];
    else if (v === "--write") a.write = argv[++i];
    else if (v === "--k") a.k = Number(argv[++i]);
    else if (v === "--folds") a.folds = Number(argv[++i]);
    else if (v === "--tree-count") a.treeCount = Number(argv[++i]);
    else if (v === "--max-thresholds") a.maxThresholds = Number(argv[++i]);
    else if (v === "--model") a.model = argv[++i];
    else if (v === "--relevance-mode") a.relevanceMode = argv[++i];
  }
  if (!a.pool || !a.embeddings) throw new Error("--pool and --embeddings are required");
  return a;
}

function mapById(rows) {
  return new Map((rows || []).map((row) => [String(row.id), row]));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pool = JSON.parse(await readFile(args.pool, "utf8"));
  const embeddings = JSON.parse(await readFile(args.embeddings, "utf8"));
  const embeddingContext = {
    provider: embeddings.provider,
    model: embeddings.model,
    dimension: embeddings.dimension,
    documentEmbeddingsById: mapById(embeddings.documents),
    queryEmbeddingsById: mapById(embeddings.queries)
  };

  // BEIR pools carry `text`; the coverage features read `abstract`. Map it.
  const cases = pool.cases.map((c) => ({
    queryId: c.queryId,
    query: c.query,
    qrels: c.qrels,
    results: c.results.map((r) => ({ ...r, abstract: r.abstract ?? r.text }))
  }));

  const rowsByQueryId = buildFeatureRowsByQuery(cases, { embeddingContext });
  const modelOptions = { k: args.k, relevanceMode: args.relevanceMode, folds: args.folds, treeCount: args.treeCount, learningRate: args.learningRate, maxDepth: args.maxDepth, minLeafSize: args.minLeafSize, maxThresholds: args.maxThresholds };

  const firstStage = evaluateRun(cases, args.k, { relevanceMode: args.relevanceMode }).aggregate.ndcgAtK;
  const cv = args.model === "boosted-trees" ? crossValidateBoostedTrees(cases, rowsByQueryId, modelOptions) : crossValidate(cases, rowsByQueryId, modelOptions);
  const ltrCvNdcg = cv.aggregate?.ndcgAtK ?? cv.metrics?.ndcgAtK ?? cv.ndcgAtK ?? null;

  let bgeHybridNdcg = null;
  if (args.bgeHybrid) {
    const bge = JSON.parse(await readFile(args.bgeHybrid, "utf8"));
    bgeHybridNdcg = bge.best?.metrics?.ndcgAtK ?? null;
  }

  const output = {
    generatedAt: "2026-07-16T00:00:00.000Z",
    dataset: pool.dataset,
    ltrModel: args.model,
    embeddingModel: embeddings.model,
    k: args.k,
    folds: args.folds,
    relevanceMode: args.relevanceMode,
    queryCount: cases.length,
    firstStageNdcg: firstStage,
    ltrCvNdcg,
    bgeHybridNdcg,
    ltrBeatsHybrid: bgeHybridNdcg !== null && ltrCvNdcg !== null ? ltrCvNdcg > bgeHybridNdcg : null,
    crossValidation: cv
  };
  if (args.write) {
    await mkdir(dirname(args.write), { recursive: true });
    await writeFile(args.write, `${JSON.stringify(output, null, 2)}\n`);
  }
  console.log(JSON.stringify({ dataset: output.dataset, model: output.ltrModel, firstStage: firstStage, ltrCv: ltrCvNdcg, bgeHybrid: bgeHybridNdcg, ltrBeatsHybrid: output.ltrBeatsHybrid, wrote: args.write || null }, null, 2));
}

main().catch((e) => { console.log(JSON.stringify({ status: "blocked", reason: "dataset_ltr_failed", message: e.message })); process.exit(1); });
