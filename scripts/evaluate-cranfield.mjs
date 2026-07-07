import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { evaluateRun } from "../src/evaluation/metrics.js";
import { searchCranfield } from "../src/cranfield/search.js";
import { mergedEnv } from "./lib/local-env.mjs";

const DOCUMENTS_PATH = new URL("../data/cranfield/sample-documents.jsonl", import.meta.url);
const QUERIES_PATH = new URL("../data/cranfield/sample-queries.json", import.meta.url);

function parseArgs(argv) {
  const args = { mode: "fixture", write: null, queries: null, k: 10, summary: false, concurrency: 5 };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--fixture") {
      args.mode = "fixture";
    } else if (value === "--live") {
      args.mode = "live";
    } else if (value === "--write") {
      args.write = argv[index + 1];
      index += 1;
    } else if (value === "--queries") {
      args.queries = argv[index + 1];
      index += 1;
    } else if (value === "--k") {
      args.k = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--summary") {
      args.summary = true;
    } else if (value === "--concurrency") {
      args.concurrency = Number(argv[index + 1]);
      index += 1;
    }
  }
  return args;
}

function tokenize(value) {
  return String(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function scoreField(queryTokens, fieldValue, boost) {
  const fieldTokens = tokenize(fieldValue);
  return queryTokens.reduce((score, token) => {
    const count = fieldTokens.filter((fieldToken) => fieldToken === token).length;
    return score + count * boost;
  }, 0);
}

function fixtureSearch(query, documents, size) {
  const queryTokens = tokenize(query);
  return documents
    .map((document) => ({
      id: document.id,
      score:
        scoreField(queryTokens, document.title, 3) +
        scoreField(queryTokens, document.abstract, 2) +
        scoreField(queryTokens, document.text, 1)
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, size);
}

async function readJson(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

async function readDocuments() {
  const content = await readFile(DOCUMENTS_PATH, "utf8");
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
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

async function runFixtureEvaluation(queries, k) {
  const documents = await readDocuments();
  return queries.map((query) => ({
    queryId: query.id,
    query: query.query,
    qrels: query.qrels,
    results: fixtureSearch(query.query, documents, k)
  }));
}

async function runLiveEvaluation(queries, k, concurrency = 5) {
  const env = envFromProcess();
  const results = new Array(queries.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(Number(concurrency) || 1, queries.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < queries.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const query = queries[currentIndex];
      const response = await searchCranfield({
        query: query.query,
        size: k,
        env
      });
      results[currentIndex] = {
        queryId: query.id,
        query: query.query,
        qrels: query.qrels,
        results: response.results
      };
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const queries = await readJson(args.queries || QUERIES_PATH);
  const cases = args.mode === "live" ? await runLiveEvaluation(queries, args.k, args.concurrency) : await runFixtureEvaluation(queries, args.k);
  const evaluation = evaluateRun(cases, args.k);

  const output = {
    generatedAt: "2026-07-04T00:00:00.000Z",
    dataset: args.queries ? "cranfield" : "cranfield-sample",
    architectureVersion: "v0-cranfield-opensearch-baseline",
    transport: args.mode === "live" ? "live-opensearch" : "fixture-validator",
    acceptanceNote:
      args.mode === "live"
        ? "Live OpenSearch evaluation run."
        : "Fixture evaluator validates metric math and run artifact shape; final Phase 1 acceptance still requires live OpenSearch data and public endpoints.",
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
      args.summary
        ? {
            generatedAt: output.generatedAt,
            dataset: output.dataset,
            architectureVersion: output.architectureVersion,
            transport: output.transport,
            metrics: output.metrics,
            queryCount: output.evaluation.queryCount,
            k: output.evaluation.k,
            concurrency: args.mode === "live" ? args.concurrency : null,
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
        reason: "cranfield_evaluation_failed",
        errorCode: error.cause?.code || error.code || null,
        valuesPrinted: false
      },
      null,
      2
    )
  );
  process.exit(1);
});
