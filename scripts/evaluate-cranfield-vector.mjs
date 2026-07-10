import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { analyzeFailureBehavior } from "../src/evaluation/failure-analysis.js";
import { evaluateRun } from "../src/evaluation/metrics.js";
import { blendRankings, rankByVector, reciprocalRankFusion } from "../src/evaluation/vector-search.js";

const DEFAULT_DOCUMENTS = "/private/tmp/retail-search-cranfield-live/documents.jsonl";
const DEFAULT_QUERIES = "/private/tmp/retail-search-cranfield-live/queries.json";

function parseArgs(argv) {
  const args = {
    embeddings: null,
    documents: DEFAULT_DOCUMENTS,
    queries: DEFAULT_QUERIES,
    retrievalCache: null,
    write: null,
    k: 10,
    vectorDepth: 50,
    retrieveSize: 50,
    summary: false,
    details: false,
    relevanceMode: "graded",
    top: 12
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--embeddings") {
      args.embeddings = argv[index + 1];
      index += 1;
    } else if (value === "--documents") {
      args.documents = argv[index + 1];
      index += 1;
    } else if (value === "--queries") {
      args.queries = argv[index + 1];
      index += 1;
    } else if (value === "--retrieval-cache") {
      args.retrievalCache = argv[index + 1];
      index += 1;
    } else if (value === "--write") {
      args.write = argv[index + 1];
      index += 1;
    } else if (value === "--k") {
      args.k = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--vector-depth") {
      args.vectorDepth = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--retrieve-size") {
      args.retrieveSize = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--relevance-mode") {
      args.relevanceMode = argv[index + 1];
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

  if (!args.embeddings) {
    throw new Error("--embeddings is required");
  }
  if (!["graded", "binary", "linear", "cranfield-reversed"].includes(args.relevanceMode)) {
    throw new Error("--relevance-mode must be graded, binary, linear, or cranfield-reversed");
  }

  return args;
}

async function readJsonl(path) {
  const content = await readFile(path, "utf8");
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function mapById(rows) {
  return new Map(rows.map((row) => [row.id, row]));
}

function evaluationSummary(name, cases, args, metadata = {}) {
  const evaluation = evaluateRun(cases, args.k, { relevanceMode: args.relevanceMode });
  const failureAnalysis = analyzeFailureBehavior(cases, evaluation.perQuery, {
    k: args.k,
    includePerQuery: args.details,
    exampleLimit: 5
  });

  return {
    name,
    ...metadata,
    metrics: {
      map: evaluation.aggregate.averagePrecision,
      ndcgAtK: evaluation.aggregate.ndcgAtK,
      precisionAtK: evaluation.aggregate.precisionAtK,
      recallAtK: evaluation.aggregate.recallAtK,
      mrr: evaluation.aggregate.reciprocalRank
    },
    evaluation,
    failureAnalysis
  };
}

function casesForRanking(queries, rankingsByQueryId) {
  return queries.map((query) => ({
    queryId: query.id,
    query: query.query,
    qrels: query.qrels,
    results: rankingsByQueryId.get(query.id) || []
  }));
}

function lexicalCasesFromCache(queries, cache, retrieveSize) {
  const cacheByQueryId = new Map(cache.cases.map((testCase) => [String(testCase.queryId), testCase]));
  return casesForRanking(
    queries,
    new Map(
      queries.map((query) => {
        const cached = cacheByQueryId.get(String(query.id));
        return [query.id, cached ? cached.results.slice(0, retrieveSize) : []];
      })
    )
  );
}

function vectorRankings(queries, queryEmbeddingById, documentEmbeddings, vectorDepth) {
  return new Map(
    queries.map((query) => [
      query.id,
      rankByVector(queryEmbeddingById.get(query.id)?.embedding || [], documentEmbeddings, { size: vectorDepth })
    ])
  );
}

function hybridLinearCases(queries, vectorRankingsByQueryId, lexicalCases, args, vectorWeight) {
  const lexicalByQueryId = new Map(lexicalCases.map((testCase) => [testCase.queryId, testCase.results]));
  const rankings = new Map(
    queries.map((query) => {
      const lexicalResults = lexicalByQueryId.get(query.id) || [];
      const vectorResults = vectorRankingsByQueryId.get(query.id) || [];
      return [
        query.id,
        blendRankings(lexicalResults, vectorResults, {
          leftWeight: 1 - vectorWeight,
          rightWeight: vectorWeight,
          size: args.retrieveSize
        })
      ];
    })
  );
  return casesForRanking(queries, rankings);
}

function hybridRrfCases(queries, vectorRankingsByQueryId, lexicalCases, args, vectorWeight) {
  const lexicalByQueryId = new Map(lexicalCases.map((testCase) => [testCase.queryId, testCase.results]));
  const rankings = new Map(
    queries.map((query) => {
      const lexicalResults = lexicalByQueryId.get(query.id) || [];
      const vectorResults = vectorRankingsByQueryId.get(query.id) || [];
      return [
        query.id,
        reciprocalRankFusion(
          [
            { weight: 1 - vectorWeight, results: lexicalResults },
            { weight: vectorWeight, results: vectorResults }
          ],
          { size: args.retrieveSize }
        )
      ];
    })
  );
  return casesForRanking(queries, rankings);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [documents, queries, embeddings] = await Promise.all([
    readJsonl(args.documents),
    JSON.parse(await readFile(args.queries, "utf8")),
    JSON.parse(await readFile(args.embeddings, "utf8"))
  ]);
  const cache = args.retrievalCache ? JSON.parse(await readFile(args.retrievalCache, "utf8")) : null;
  const documentById = mapById(documents);
  const documentEmbeddings = embeddings.documents.filter((row) => documentById.has(row.id));
  const queryEmbeddingById = mapById(embeddings.queries);
  const vectorRankingsByQueryId = vectorRankings(queries, queryEmbeddingById, documentEmbeddings, args.vectorDepth);
  const runs = [];

  runs.push(
    evaluationSummary("vector-only", casesForRanking(queries, vectorRankingsByQueryId), args, {
      retrieval: "dense-vector",
      vectorWeight: 1
    })
  );

  if (cache) {
    const lexicalCases = lexicalCasesFromCache(queries, cache, args.retrieveSize);
    runs.push(
      evaluationSummary("field-sum-cache", lexicalCases, args, {
        retrieval: "cached-opensearch-field-sum",
        vectorWeight: 0
      })
    );

    for (const vectorWeight of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
      runs.push(
        evaluationSummary(`hybrid-linear-vector-${vectorWeight}`, hybridLinearCases(queries, vectorRankingsByQueryId, lexicalCases, args, vectorWeight), args, {
          retrieval: "cached-field-sum-plus-vector-linear",
          vectorWeight
        })
      );
      runs.push(
        evaluationSummary(`hybrid-rrf-vector-${vectorWeight}`, hybridRrfCases(queries, vectorRankingsByQueryId, lexicalCases, args, vectorWeight), args, {
          retrieval: "cached-field-sum-plus-vector-rrf",
          vectorWeight
        })
      );
    }
  }

  const sortedRuns = [...runs].sort(
    (a, b) => b.metrics.ndcgAtK - a.metrics.ndcgAtK || b.metrics.map - a.metrics.map || b.metrics.mrr - a.metrics.mrr
  );
  const output = {
    generatedAt: new Date().toISOString(),
    dataset: "cranfield",
    transport: "offline-vector-evaluator",
    embeddingSource: args.embeddings,
    embeddingProvider: embeddings.provider,
    embeddingModel: embeddings.model,
    embeddingCaveat: embeddings.caveat,
    documentsSource: args.documents,
    queriesSource: args.queries,
    retrievalCache: args.retrievalCache,
    k: args.k,
    retrieveSize: args.retrieveSize,
    vectorDepth: args.vectorDepth,
    relevanceMode: args.relevanceMode,
    documentCount: documentEmbeddings.length,
    queryCount: queries.length,
    best: {
      name: sortedRuns[0].name,
      retrieval: sortedRuns[0].retrieval,
      vectorWeight: sortedRuns[0].vectorWeight,
      metrics: sortedRuns[0].metrics
    },
    runs: sortedRuns.slice(0, args.top),
    allRuns: runs.map((run) => ({
      name: run.name,
      retrieval: run.retrieval,
      vectorWeight: run.vectorWeight,
      metrics: run.metrics
    }))
  };

  if (args.write) {
    await mkdir(dirname(args.write), { recursive: true });
    await writeFile(args.write, `${JSON.stringify(output, null, 2)}\n`);
  }

  console.log(JSON.stringify(args.summary ? { ...output, runs: output.runs.map((run) => ({ name: run.name, retrieval: run.retrieval, vectorWeight: run.vectorWeight, metrics: run.metrics })), allRuns: undefined } : output, null, 2));
}

main().catch((error) => {
  console.log(
    JSON.stringify(
      {
        status: "blocked",
        reason: "cranfield_vector_evaluation_failed",
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
