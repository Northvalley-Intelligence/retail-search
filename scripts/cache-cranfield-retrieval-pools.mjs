import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { searchCranfield } from "../src/cranfield/search.js";
import { DEFAULT_SEARCH_ARCHITECTURE_ID, resolveSearchArchitecture } from "../src/cranfield/schema.js";
import { mergedEnv } from "./lib/local-env.mjs";

function parseArgs(argv) {
  const args = {
    queries: "/private/tmp/retail-search-cranfield-live/queries.json",
    write: null,
    retrieveSize: 50,
    concurrency: 10,
    architecture: "field-sum",
    summary: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--queries") {
      args.queries = argv[index + 1];
      index += 1;
    } else if (value === "--write") {
      args.write = argv[index + 1];
      index += 1;
    } else if (value === "--retrieve-size") {
      args.retrieveSize = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--concurrency") {
      args.concurrency = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--architecture") {
      args.architecture = argv[index + 1] || DEFAULT_SEARCH_ARCHITECTURE_ID;
      index += 1;
    } else if (value === "--summary") {
      args.summary = true;
    }
  }

  if (!args.write) {
    throw new Error("--write is required");
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

function cacheResult(result) {
  return {
    id: result.id,
    score: result.score,
    title: result.title,
    abstract: result.abstract,
    source: result.source
  };
}

async function retrieveCases(queries, args, searchArchitecture) {
  const env = envFromProcess();
  const cases = new Array(queries.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(Number(args.concurrency) || 1, queries.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < queries.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const query = queries[currentIndex];
      const response = await searchCranfield({
        query: query.query,
        size: args.retrieveSize,
        env,
        architecture: searchArchitecture.id
      });
      cases[currentIndex] = {
        queryId: query.id,
        query: query.query,
        qrels: query.qrels,
        resultCount: response.resultCount,
        totalHits: response.totalHits,
        openSearchTookMs: response.latency.openSearchTookMs,
        results: response.results.map(cacheResult)
      };
    }
  });
  await Promise.all(workers);
  return cases;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const searchArchitecture = resolveSearchArchitecture(args.architecture);
  const queries = JSON.parse(await readFile(args.queries, "utf8"));
  const cases = await retrieveCases(queries, args, searchArchitecture);
  const output = {
    generatedAt: new Date().toISOString(),
    dataset: "cranfield",
    transport: "live-opensearch-cache",
    querySource: args.queries,
    retrieveSize: args.retrieveSize,
    queryCount: cases.length,
    architectureVersion: searchArchitecture.architectureSlug,
    searchArchitecture,
    cases
  };

  await mkdir(dirname(args.write), { recursive: true });
  await writeFile(args.write, `${JSON.stringify(output, null, 2)}\n`);

  const summary = {
    generatedAt: output.generatedAt,
    dataset: output.dataset,
    transport: output.transport,
    queryCount: output.queryCount,
    retrieveSize: output.retrieveSize,
    architecture: searchArchitecture.id,
    wrote: args.write
  };
  console.log(JSON.stringify(args.summary ? summary : output, null, 2));
}

main().catch((error) => {
  console.log(
    JSON.stringify(
      {
        status: "blocked",
        reason: "cranfield_retrieval_cache_failed",
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
