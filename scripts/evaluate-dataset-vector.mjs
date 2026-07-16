// Generic dense/hybrid retrieval evaluator (M-0002.3 BGE column).
// Mirrors evaluate-cranfield-vector.mjs but reads a BEIR embeddings file plus a
// cached retrieval pool (which carries qrels), so any dataset's BGE hybrid gain is
// measured offline with no live kNN index. Reuses the shared vector-search fusion.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { evaluateRun } from "../src/evaluation/metrics.js";
import { blendRankings, rankByVector, reciprocalRankFusion } from "../src/evaluation/vector-search.js";
import { getDataset } from "../src/datasets/registry.js";

function parseArgs(argv) {
  const args = { embeddings: null, pool: null, k: 10, retrieveSize: 100, vectorDepth: 100, write: null, relevanceMode: "linear" };
  for (let i = 0; i < argv.length; i += 1) {
    const v = argv[i];
    if (v === "--embeddings") { args.embeddings = argv[++i]; }
    else if (v === "--pool") { args.pool = argv[++i]; }
    else if (v === "--k") { args.k = Number(argv[++i]); }
    else if (v === "--retrieve-size") { args.retrieveSize = Number(argv[++i]); }
    else if (v === "--vector-depth") { args.vectorDepth = Number(argv[++i]); }
    else if (v === "--write") { args.write = argv[++i]; }
    else if (v === "--relevance-mode") { args.relevanceMode = argv[++i]; }
  }
  if (!args.embeddings || !args.pool) {
    throw new Error("--embeddings and --pool are required");
  }
  return args;
}

function casesFor(poolCases, rankingByQueryId, k) {
  return poolCases.map((pc) => ({
    queryId: pc.queryId,
    query: pc.query,
    qrels: pc.qrels,
    results: (rankingByQueryId.get(pc.queryId) || []).slice(0, k)
  }));
}

function summarize(label, cases, k, relevanceMode, extra = {}) {
  const evaluation = evaluateRun(cases, k, { relevanceMode });
  return {
    label,
    ...extra,
    metrics: {
      map: evaluation.aggregate.averagePrecision,
      ndcgAtK: evaluation.aggregate.ndcgAtK,
      precisionAtK: evaluation.aggregate.precisionAtK,
      recallAtK: evaluation.aggregate.recallAtK,
      mrr: evaluation.aggregate.reciprocalRank
    }
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const embeddings = JSON.parse(await readFile(args.embeddings, "utf8"));
  const pool = JSON.parse(await readFile(args.pool, "utf8"));

  const documentEmbeddings = embeddings.documents;
  const queryEmbeddingById = new Map(embeddings.queries.map((row) => [String(row.id), row.embedding]));
  const poolCases = pool.cases;

  // BEIR excludes a query's own document from results (ArguAna, Quora). The pool
  // cache already applies this on the lexical side; mirror it on the vector side.
  let ignoreIdenticalIds = false;
  try {
    ignoreIdenticalIds = getDataset(pool.dataset).ignoreIdenticalIds || false;
  } catch { /* unknown dataset id: leave false */ }

  // Full-corpus dense ranking per query (captures vector recall of BM25-missed docs).
  const vectorRankingByQueryId = new Map();
  for (const pc of poolCases) {
    const qv = queryEmbeddingById.get(String(pc.queryId));
    if (!qv) {
      vectorRankingByQueryId.set(pc.queryId, []);
      continue;
    }
    const ranked = rankByVector(qv, documentEmbeddings, { size: args.vectorDepth + (ignoreIdenticalIds ? 1 : 0) });
    vectorRankingByQueryId.set(
      pc.queryId,
      (ignoreIdenticalIds ? ranked.filter((r) => r.id !== String(pc.queryId)) : ranked).slice(0, args.vectorDepth)
    );
  }

  // Lexical ranking straight from the cached pool (BM25/field-sum scores).
  const lexicalRankingByQueryId = new Map(
    poolCases.map((pc) => [pc.queryId, pc.results.map((r) => ({ id: r.id, score: r.score }))])
  );

  const runs = [];
  runs.push(summarize("lexical-first-stage", casesFor(poolCases, lexicalRankingByQueryId, args.k), args.k, args.relevanceMode, { retrieval: pool.firstStage, vectorWeight: 0 }));
  runs.push(summarize("vector-only", casesFor(poolCases, vectorRankingByQueryId, args.k), args.k, args.relevanceMode, { retrieval: "dense-bge", vectorWeight: 1 }));

  for (const w of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
    const linear = new Map();
    const rrf = new Map();
    for (const pc of poolCases) {
      const lex = lexicalRankingByQueryId.get(pc.queryId) || [];
      const vec = vectorRankingByQueryId.get(pc.queryId) || [];
      linear.set(pc.queryId, blendRankings(lex, vec, { leftWeight: 1 - w, rightWeight: w, size: args.retrieveSize }));
      rrf.set(pc.queryId, reciprocalRankFusion([{ weight: 1 - w, results: lex }, { weight: w, results: vec }], { size: args.retrieveSize }));
    }
    runs.push(summarize(`hybrid-linear-${w}`, casesFor(poolCases, linear, args.k), args.k, args.relevanceMode, { retrieval: "bge-hybrid-linear", vectorWeight: w }));
    runs.push(summarize(`hybrid-rrf-${w}`, casesFor(poolCases, rrf, args.k), args.k, args.relevanceMode, { retrieval: "bge-hybrid-rrf", vectorWeight: w }));
  }

  const sorted = [...runs].sort((a, b) => b.metrics.ndcgAtK - a.metrics.ndcgAtK);
  const output = {
    generatedAt: "2026-07-16T00:00:00.000Z",
    dataset: pool.dataset,
    model: embeddings.model,
    firstStage: pool.firstStage,
    k: args.k,
    relevanceMode: args.relevanceMode,
    queryCount: poolCases.length,
    best: sorted[0],
    lexicalBaseline: runs.find((r) => r.label === "lexical-first-stage").metrics.ndcgAtK,
    vectorOnly: runs.find((r) => r.label === "vector-only").metrics.ndcgAtK,
    runs
  };
  if (args.write) {
    await mkdir(dirname(args.write), { recursive: true });
    await writeFile(args.write, `${JSON.stringify(output, null, 2)}\n`);
  }
  console.log(JSON.stringify({
    dataset: output.dataset, model: output.model, queries: output.queryCount,
    lexicalBaseline: output.lexicalBaseline, vectorOnly: output.vectorOnly,
    best: { label: output.best.label, ndcgAtK: output.best.metrics.ndcgAtK }, wrote: args.write || null
  }, null, 2));
}

main().catch((error) => {
  console.log(JSON.stringify({ status: "blocked", reason: "vector_eval_failed", message: error.message }, null, 2));
  process.exit(1);
});
