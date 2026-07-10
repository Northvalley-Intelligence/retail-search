import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { buildCranfieldSearchBody } from "../src/cranfield/search.js";
import { buildOpenSearchHeaders } from "../src/opensearch.js";
import { analyzeFailureBehavior } from "../src/evaluation/failure-analysis.js";
import { evaluateRun } from "../src/evaluation/metrics.js";
import { blendRankings, reciprocalRankFusion } from "../src/evaluation/vector-search.js";
import { mergedEnv } from "./lib/local-env.mjs";

const DEFAULT_QUERIES = "/private/tmp/retail-search-cranfield-live/queries.json";
const DEFAULT_EMBEDDINGS = "experiments/cranfield-v0/embeddings-huggingface-bge-base-en-v15-title-abstract-gen022.json";
const DEFAULT_INDEX = "cranfield-v0-bge-base-en-v15-gen023";

function parseArgs(argv) {
  const args = {
    queries: DEFAULT_QUERIES,
    embeddings: DEFAULT_EMBEDDINGS,
    index: DEFAULT_INDEX,
    write: null,
    vectorField: "bge_embedding",
    k: 10,
    retrieveSize: 50,
    vectorDepth: 50,
    concurrency: 10,
    relevanceMode: "graded",
    summary: false,
    details: false,
    top: 20
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--queries") {
      args.queries = argv[index + 1];
      index += 1;
    } else if (value === "--embeddings") {
      args.embeddings = argv[index + 1];
      index += 1;
    } else if (value === "--index") {
      args.index = argv[index + 1];
      index += 1;
    } else if (value === "--write") {
      args.write = argv[index + 1];
      index += 1;
    } else if (value === "--vector-field") {
      args.vectorField = argv[index + 1];
      index += 1;
    } else if (value === "--k") {
      args.k = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--retrieve-size") {
      args.retrieveSize = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--vector-depth") {
      args.vectorDepth = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--concurrency") {
      args.concurrency = Number(argv[index + 1]);
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

  if (!args.write) {
    throw new Error("--write is required");
  }
  if (!["graded", "binary", "linear", "cranfield-reversed"].includes(args.relevanceMode)) {
    throw new Error("--relevance-mode must be graded, binary, linear, or cranfield-reversed");
  }
  return args;
}

function requireConfig(env) {
  const missing = [];
  if (!env.OPENSEARCH_URL) missing.push("OPENSEARCH_URL");
  if (!env.OPENSEARCH_API_KEY && !(env.OPENSEARCH_USERNAME && env.OPENSEARCH_PASSWORD)) {
    missing.push("OPENSEARCH_API_KEY or OPENSEARCH_USERNAME and OPENSEARCH_PASSWORD");
  }
  if (missing.length) {
    throw new Error(`Missing OpenSearch configuration: ${missing.join(", ")}`);
  }
}

function buildUrl(env, pathname) {
  return `${String(env.OPENSEARCH_URL).replace(/\/+$/u, "")}${pathname}`;
}

async function request(env, pathname, init = {}) {
  const response = await fetch(buildUrl(env, pathname), {
    ...init,
    headers: {
      ...buildOpenSearchHeaders(env),
      ...(init.headers || {})
    }
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text.slice(0, 200) };
  }
  if (!response.ok) {
    throw new Error(`OpenSearch request failed: ${response.status} ${JSON.stringify(payload).slice(0, 500)}`);
  }
  return payload;
}

function mapById(rows = []) {
  return new Map(rows.map((row) => [String(row.id), row]));
}

function mapHit(hit) {
  const source = hit._source || {};
  return {
    id: String(source.id || hit._id),
    score: Number(hit._score || 0),
    title: source.title || "",
    abstract: source.abstract || "",
    source: source.source || "cranfield"
  };
}

function vectorSearchBody(vector, args) {
  return {
    size: args.vectorDepth,
    track_total_hits: true,
    _source: ["id", "dataset", "title", "abstract", "source"],
    query: {
      knn: {
        [args.vectorField]: {
          vector,
          k: args.vectorDepth
        }
      }
    }
  };
}

function lexicalSearchBody(query, args) {
  return buildCranfieldSearchBody(query, {
    architecture: "field-sum",
    size: args.retrieveSize
  });
}

async function searchCase(env, query, queryEmbeddingById, args) {
  const queryEmbedding = queryEmbeddingById.get(String(query.id))?.embedding;
  if (!queryEmbedding) {
    throw new Error(`Missing query embedding for query ${query.id}`);
  }
  const [vectorPayload, lexicalPayload] = await Promise.all([
    request(env, `/${encodeURIComponent(args.index)}/_search`, {
      method: "POST",
      body: JSON.stringify(vectorSearchBody(queryEmbedding, args))
    }),
    request(env, `/${encodeURIComponent(args.index)}/_search`, {
      method: "POST",
      body: JSON.stringify(lexicalSearchBody(query.query, args))
    })
  ]);

  return {
    queryId: String(query.id),
    query: query.query,
    qrels: query.qrels,
    vectorResults: (vectorPayload?.hits?.hits || []).map(mapHit),
    lexicalResults: (lexicalPayload?.hits?.hits || []).map(mapHit),
    openSearchTookMs: {
      vector: vectorPayload?.took ?? null,
      lexical: lexicalPayload?.took ?? null
    }
  };
}

async function searchCases(env, queries, queryEmbeddingById, args) {
  const cases = new Array(queries.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(Number(args.concurrency) || 1, queries.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < queries.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      cases[currentIndex] = await searchCase(env, queries[currentIndex], queryEmbeddingById, args);
    }
  });
  await Promise.all(workers);
  return cases;
}

function casesWithResults(remoteCases, resultSelector) {
  return remoteCases.map((testCase) => ({
    queryId: testCase.queryId,
    query: testCase.query,
    qrels: testCase.qrels,
    results: resultSelector(testCase)
  }));
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

function hybridLinearResults(testCase, args, vectorWeight) {
  return blendRankings(testCase.lexicalResults.slice(0, args.retrieveSize), testCase.vectorResults.slice(0, args.vectorDepth), {
    leftWeight: 1 - vectorWeight,
    rightWeight: vectorWeight,
    size: args.retrieveSize
  });
}

function hybridRrfResults(testCase, args, vectorWeight) {
  return reciprocalRankFusion(
    [
      { weight: 1 - vectorWeight, results: testCase.lexicalResults.slice(0, args.retrieveSize) },
      { weight: vectorWeight, results: testCase.vectorResults.slice(0, args.vectorDepth) }
    ],
    { size: args.retrieveSize }
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = mergedEnv();
  requireConfig(env);

  const [queries, embeddings] = await Promise.all([
    JSON.parse(await readFile(args.queries, "utf8")),
    JSON.parse(await readFile(args.embeddings, "utf8"))
  ]);
  const queryEmbeddingById = mapById(embeddings.queries);
  const remoteCases = await searchCases(env, queries, queryEmbeddingById, args);
  const runs = [
    evaluationSummary("remote-vector-only", casesWithResults(remoteCases, (testCase) => testCase.vectorResults), args, {
      retrieval: "remote-opensearch-knn-vector",
      vectorWeight: 1
    }),
    evaluationSummary("remote-field-sum", casesWithResults(remoteCases, (testCase) => testCase.lexicalResults), args, {
      retrieval: "remote-opensearch-field-sum",
      vectorWeight: 0
    })
  ];

  for (const vectorWeight of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
    runs.push(
      evaluationSummary(`remote-hybrid-linear-vector-${vectorWeight}`, casesWithResults(remoteCases, (testCase) => hybridLinearResults(testCase, args, vectorWeight)), args, {
        retrieval: "remote-field-sum-plus-remote-vector-linear",
        vectorWeight
      })
    );
    runs.push(
      evaluationSummary(`remote-hybrid-rrf-vector-${vectorWeight}`, casesWithResults(remoteCases, (testCase) => hybridRrfResults(testCase, args, vectorWeight)), args, {
        retrieval: "remote-field-sum-plus-remote-vector-rrf",
        vectorWeight
      })
    );
  }

  const sortedRuns = [...runs].sort(
    (a, b) => b.metrics.ndcgAtK - a.metrics.ndcgAtK || b.metrics.map - a.metrics.map || b.metrics.mrr - a.metrics.mrr
  );
  const output = {
    generatedAt: new Date().toISOString(),
    dataset: "cranfield",
    transport: "live-opensearch-bge-vector-evaluator",
    index: args.index,
    vectorField: args.vectorField,
    embeddingSource: args.embeddings,
    embeddingProvider: embeddings.provider,
    embeddingModel: embeddings.model,
    embeddingDimension: embeddings.dimension,
    querySource: args.queries,
    k: args.k,
    retrieveSize: args.retrieveSize,
    vectorDepth: args.vectorDepth,
    relevanceMode: args.relevanceMode,
    queryCount: queries.length,
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
    })),
    cases: args.details
      ? remoteCases.map((testCase) => ({
          queryId: testCase.queryId,
          query: testCase.query,
          qrels: testCase.qrels,
          openSearchTookMs: testCase.openSearchTookMs,
          vectorResults: testCase.vectorResults,
          lexicalResults: testCase.lexicalResults
        }))
      : undefined
  };

  await mkdir(dirname(args.write), { recursive: true });
  await writeFile(args.write, `${JSON.stringify(output, null, 2)}\n`);

  console.log(
    JSON.stringify(
      args.summary
        ? {
            ...output,
            runs: output.runs.map((run) => ({
              name: run.name,
              retrieval: run.retrieval,
              vectorWeight: run.vectorWeight,
              metrics: run.metrics
            })),
            allRuns: undefined,
            cases: undefined
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
        reason: "cranfield_opensearch_vector_evaluation_failed",
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
