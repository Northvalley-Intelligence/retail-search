import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import {
  buildBeirBm25SearchBody,
  buildBeirEvaluationQueries,
  parseBeirCorpus,
  parseBeirQueries,
  parseBeirQrels,
  parseBeirSearchResponse
} from "../../src/datasets/beir.js";
import { getDataset } from "../../src/datasets/registry.js";
import { executeOpenSearchSearch } from "../../src/opensearch.js";
import { searchCranfield } from "../../src/cranfield/search.js";

export function resolveDataset(datasetId) {
  return getDataset(datasetId);
}

// Streams line by line: Tier 2-3 corpus files exceed the V8 single-string limit.
export async function loadBeirCorpusDocuments(dataset, dataDir = null) {
  const directory = dataDir || dataset.dataDir;
  const documents = [];
  const lines = createInterface({
    input: createReadStream(join(directory, "corpus.jsonl")),
    crlfDelay: Infinity
  });
  for await (const line of lines) {
    if (line) {
      documents.push(...parseBeirCorpus(line));
    }
  }
  return documents;
}

export async function loadEvaluationCases(dataset, { dataDir = null, queriesPath = null } = {}) {
  if (dataset.family === "beir") {
    const directory = dataDir || dataset.dataDir;
    const qrels = parseBeirQrels(await readFile(join(directory, `qrels/${dataset.qrelsSplit}.tsv`), "utf8"));
    const neededIds = new Set(Object.keys(qrels));
    // Streamed with an id pre-filter: some BEIR queries files (CQADupStack) are
    // multi-gigabyte while the qrels split needs only a few hundred queries.
    const queries = [];
    const lines = createInterface({
      input: createReadStream(join(directory, "queries.jsonl")),
      crlfDelay: Infinity
    });
    for await (const line of lines) {
      if (!line) {
        continue;
      }
      const idMatch = line.match(/"_id"\s*:\s*"((?:[^"\\]|\\.)*)"/u);
      if (idMatch && neededIds.has(JSON.parse(`"${idMatch[1]}"`))) {
        queries.push(...parseBeirQueries(line));
      }
    }
    return buildBeirEvaluationQueries(queries, qrels);
  }
  if (dataset.family === "cranfield") {
    const path = queriesPath || join(dataset.dataDir, "sample-queries.json");
    return JSON.parse(await readFile(path, "utf8"));
  }
  throw new Error(`No evaluation loader for dataset family ${dataset.family}`);
}

export function datasetIndex(dataset, env = {}, override = null) {
  if (override) {
    return override;
  }
  if (dataset.family === "cranfield") {
    return env.CRANFIELD_INDEX || dataset.defaultIndex;
  }
  return dataset.defaultIndex;
}

export async function searchDataset({ dataset, query, size, env, index = null, architecture = null }) {
  if (dataset.family === "cranfield") {
    const response = await searchCranfield({ query, size, env, ...(architecture ? { architecture } : {}) });
    return response.results;
  }
  if (dataset.family === "beir") {
    const payload = await executeOpenSearchSearch({
      env,
      index: datasetIndex(dataset, env, index),
      body: buildBeirBm25SearchBody(query, size)
    });
    return parseBeirSearchResponse(payload);
  }
  throw new Error(`No search executor for dataset family ${dataset.family}`);
}
