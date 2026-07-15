// Generic retrieval-pool cache (GEN-017 fast-loop pattern, generalized in M-0002.3
// groundwork): caches first-stage top-K results with document text for any BEIR
// dataset so rerankers tune offline without re-querying OpenSearch.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { executeOpenSearchSearch } from "../src/opensearch.js";
import { loadEvaluationCases, resolveDataset, datasetIndex } from "./lib/datasets.mjs";
import { mergedEnv } from "./lib/local-env.mjs";

function parseArgs(argv) {
  const args = { dataset: null, size: 50, write: null, index: null, concurrency: 5, firstStage: "bm25-multi-match" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--dataset") {
      args.dataset = argv[index + 1];
      index += 1;
    } else if (value === "--size") {
      args.size = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--write") {
      args.write = argv[index + 1];
      index += 1;
    } else if (value === "--index") {
      args.index = argv[index + 1];
      index += 1;
    } else if (value === "--concurrency") {
      args.concurrency = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--first-stage") {
      args.firstStage = argv[index + 1];
      index += 1;
    }
  }
  if (!args.dataset || !args.write) {
    throw new Error("--dataset and --write are required");
  }
  if (!["bm25-multi-match", "field-sum"].includes(args.firstStage)) {
    throw new Error("--first-stage must be bm25-multi-match or field-sum");
  }
  return args;
}

// First-stage bodies with document text kept so offline rerankers (coverage,
// PRF, cross-encoder) can work from the cache. bm25-multi-match matches the
// published baseline; field-sum is the Phase 1 ARCH-0.2 first stage mapped onto
// BEIR's two fields (Cranfield boosts title 3 / abstract 2 -> title 3 / text 2).
function poolSearchBody(query, size, firstStage) {
  const source = { _source: ["title", "text"], size };
  if (firstStage === "field-sum") {
    return {
      ...source,
      query: {
        bool: {
          should: [
            { match: { title: { query: String(query), operator: "or", boost: 3 } } },
            { match: { text: { query: String(query), operator: "or", boost: 2 } } }
          ]
        }
      }
    };
  }
  return {
    ...source,
    query: {
      multi_match: {
        query: String(query),
        type: "best_fields",
        fields: ["title", "text"],
        tie_breaker: 0.5
      }
    }
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dataset = resolveDataset(args.dataset);
  if (dataset.family !== "beir") {
    throw new Error("Pool caching currently supports BEIR-family datasets; Cranfield pools use cache:cranfield.");
  }
  const env = mergedEnv();
  const queries = await loadEvaluationCases(dataset, {});
  const index = datasetIndex(dataset, env, args.index);

  const cases = new Array(queries.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(args.concurrency, queries.length)) }, async () => {
    while (nextIndex < queries.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const query = queries[currentIndex];
      const payload = await executeOpenSearchSearch({
        env,
        index,
        body: poolSearchBody(query.query, dataset.ignoreIdenticalIds ? args.size + 1 : args.size, args.firstStage)
      });
      const hits = (payload?.hits?.hits || [])
        .map((hit) => ({
          id: String(hit._id),
          score: hit._score,
          title: hit._source?.title ?? "",
          text: hit._source?.text ?? ""
        }))
        .filter((hit) => !dataset.ignoreIdenticalIds || hit.id !== query.id)
        .slice(0, args.size);
      cases[currentIndex] = {
        queryId: query.id,
        query: query.query,
        qrels: query.qrels,
        resultCount: hits.length,
        totalHits: payload?.hits?.total?.value ?? null,
        openSearchTookMs: payload?.took ?? null,
        results: hits
      };
    }
  });
  await Promise.all(workers);

  const output = {
    generatedAt: "2026-07-15T00:00:00.000Z",
    dataset: dataset.id,
    transport: "live-opensearch",
    querySource: `${dataset.dataDir}/queries.jsonl (${dataset.qrelsSplit} split)`,
    firstStage: args.firstStage,
    retrieveSize: args.size,
    queryCount: cases.length,
    index,
    cases
  };
  await mkdir(dirname(args.write), { recursive: true });
  await writeFile(args.write, `${JSON.stringify(output, null, 2)}\n`);
  console.log(
    JSON.stringify(
      { status: "ok", dataset: dataset.id, index, queryCount: cases.length, retrieveSize: args.size, wrote: args.write },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.log(
    JSON.stringify(
      { status: "blocked", reason: "pool_cache_failed", message: error.message.replace(/https?:\/\/\S+/gu, "<redacted-url>") },
      null,
      2
    )
  );
  process.exit(1);
});
