import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { evaluateRun } from "../src/evaluation/metrics.js";
import { searchCranfield } from "../src/cranfield/search.js";
import { mergedEnv } from "./lib/local-env.mjs";

const STOPWORDS = new Set([
  "what",
  "are",
  "is",
  "the",
  "a",
  "an",
  "of",
  "to",
  "in",
  "and",
  "or",
  "for",
  "with",
  "on",
  "by",
  "from",
  "has",
  "have",
  "been",
  "be",
  "can",
  "did",
  "does",
  "do",
  "about",
  "at",
  "which",
  "that",
  "this",
  "into",
  "it",
  "anyone",
  "else",
  "not",
  "so",
  "far",
  "must",
  "when",
  "under",
  "over",
  "based",
  "as",
  "some",
  "using",
  "than",
  "other",
  "possible",
  "available",
  "could",
  "would",
  "should",
  "there",
  "any",
  "just",
  "how",
  "why",
  "if",
  "then",
  "where",
  "who",
  "whose",
  "such",
  "these",
  "those",
  "was",
  "were",
  "will",
  "shall",
  "may",
  "might",
  "its",
  "their",
  "but",
  "all",
  "after",
  "before",
  "beyond",
  "between",
  "while",
  "during",
  "per",
  "via",
  "also",
  "used",
  "use",
  "due",
  "out",
  "up",
  "down",
  "high",
  "low",
  "very",
  "information",
  "method",
  "methods",
  "problem",
  "problems",
  "results",
  "result",
  "data",
  "effect",
  "effects",
  "solution",
  "solutions",
  "determine",
  "determined",
  "calculated",
  "calculation",
  "investigation",
  "investigations",
  "study",
  "studies",
  "paper",
  "papers"
]);

function parseArgs(argv) {
  const args = {
    queries: "/private/tmp/retail-search-cranfield-live/queries.json",
    retrievalCache: null,
    write: null,
    k: 10,
    retrieveSize: 50,
    concurrency: 10,
    top: 12
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--queries") {
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
    } else if (value === "--retrieve-size") {
      args.retrieveSize = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--concurrency") {
      args.concurrency = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--top") {
      args.top = Number(argv[index + 1]);
      index += 1;
    }
  }

  return args;
}

function significantTokens(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function coverageScoreForTokens(tokens, result) {
  const queryTokens = Array.from(new Set(tokens));
  if (queryTokens.length === 0) {
    return 0;
  }

  const titleTokens = new Set(significantTokens(result.title));
  const abstractTokens = new Set(significantTokens(result.abstract));
  let titleHits = 0;
  let abstractHits = 0;
  let anyHits = 0;

  for (const token of queryTokens) {
    const titleHit = titleTokens.has(token);
    const abstractHit = abstractTokens.has(token);
    if (titleHit) titleHits += 1;
    if (abstractHit) abstractHits += 1;
    if (titleHit || abstractHit) anyHits += 1;
  }

  const denominator = queryTokens.length;
  return (3 * titleHits) / denominator + (2 * abstractHits) / denominator + anyHits / denominator;
}

function bigrams(tokens) {
  const rows = [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    rows.push(`${tokens[index]} ${tokens[index + 1]}`);
  }
  return rows;
}

function phraseCoverageScore(queryTokens, result) {
  const queryPhrases = Array.from(new Set(bigrams(queryTokens)));
  if (queryPhrases.length === 0) {
    return 0;
  }

  const titlePhrases = new Set(bigrams(significantTokens(result.title)));
  const abstractPhrases = new Set(bigrams(significantTokens(result.abstract)));
  let titleHits = 0;
  let abstractHits = 0;

  for (const phrase of queryPhrases) {
    if (titlePhrases.has(phrase)) titleHits += 1;
    if (abstractPhrases.has(phrase)) abstractHits += 1;
  }

  return (3 * titleHits) / queryPhrases.length + (2 * abstractHits) / queryPhrases.length;
}

function feedbackTerms(results, originalTokens, feedbackDocuments, feedbackTermCount) {
  const original = new Set(originalTokens);
  const weights = new Map();
  const feedbackResults = results.slice(0, feedbackDocuments);

  feedbackResults.forEach((result, index) => {
    const rankWeight = 1 / (index + 1);
    const feedbackText = `${result.title || ""} ${result.title || ""} ${result.abstract || ""}`;
    for (const token of significantTokens(feedbackText)) {
      if (!original.has(token)) {
        weights.set(token, (weights.get(token) || 0) + rankWeight);
      }
    }
  });

  return Array.from(weights.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, feedbackTermCount)
    .map(([token]) => token);
}

function rerank(query, results, config) {
  const originalTokens = significantTokens(query);
  const expansionTerms = feedbackTerms(results, originalTokens, config.feedbackDocuments, config.feedbackTerms);
  const maxScore = Math.max(...results.map((result) => result.score || 0), 1);
  return results
    .map((result, index) => ({
      ...result,
      rerankScore:
        Math.round(
          (((result.score || 0) / maxScore +
            config.originalWeight * coverageScoreForTokens(originalTokens, result) +
            config.expansionWeight * coverageScoreForTokens(expansionTerms, result) +
            config.phraseWeight * phraseCoverageScore(originalTokens, result)) *
            10000)
        ) / 10000,
      originalRank: index + 1
    }))
    .sort((a, b) => b.rerankScore - a.rerankScore || a.originalRank - b.originalRank);
}

function configs() {
  const rows = [];
  for (const phraseWeight of [0, 0.01, 0.02, 0.04, 0.06]) {
    rows.push({
      feedbackDocuments: 4,
      feedbackTerms: 8,
      originalWeight: 0.06,
      expansionWeight: 0.14,
      phraseWeight
    });
  }
  return rows;
}

async function retrieveCases(queries, args) {
  const env = mergedEnv();
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
        architecture: "field-sum"
      });
      cases[currentIndex] = {
        queryId: query.id,
        query: query.query,
        qrels: query.qrels,
        results: response.results
      };
    }
  });
  await Promise.all(workers);
  return cases;
}

async function readRetrievalCache(path) {
  const cache = JSON.parse(await readFile(path, "utf8"));
  if (!Array.isArray(cache.cases)) {
    throw new Error(`${path} does not include a cases array`);
  }
  return cache;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cache = args.retrievalCache ? await readRetrievalCache(args.retrievalCache) : null;
  const queries = cache ? null : JSON.parse(await readFile(args.queries, "utf8"));
  const fieldSumCases = cache ? cache.cases : await retrieveCases(queries, args);
  const evaluated = configs()
    .map((config) => {
      const cases = fieldSumCases.map((testCase) => ({
        ...testCase,
        results: rerank(testCase.query, testCase.results, config)
      }));
      const evaluation = evaluateRun(cases, args.k);
      return {
        ...config,
        metrics: {
          map: evaluation.aggregate.averagePrecision,
          ndcgAtK: evaluation.aggregate.ndcgAtK,
          precisionAtK: evaluation.aggregate.precisionAtK,
          recallAtK: evaluation.aggregate.recallAtK,
          mrr: evaluation.aggregate.reciprocalRank
        }
      };
    })
    .sort((a, b) => b.metrics.ndcgAtK - a.metrics.ndcgAtK || b.metrics.map - a.metrics.map || b.metrics.mrr - a.metrics.mrr);

  const output = {
    generatedAt: new Date().toISOString(),
    dataset: "cranfield",
    retrievalSource: args.retrievalCache || "live-opensearch",
    sourceArchitecture: cache?.searchArchitecture?.id || "field-sum",
    k: args.k,
    retrieveSize: cache?.retrieveSize || args.retrieveSize,
    queryCount: fieldSumCases.length,
    configCount: evaluated.length,
    top: evaluated.slice(0, args.top)
  };

  if (args.write) {
    await mkdir(dirname(args.write), { recursive: true });
    await writeFile(args.write, `${JSON.stringify(output, null, 2)}\n`);
  }

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.log(
    JSON.stringify(
      {
        status: "blocked",
        reason: "cranfield_prf_tuning_failed",
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
