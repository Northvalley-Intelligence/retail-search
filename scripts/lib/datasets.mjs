import { readFile } from "node:fs/promises";
import { join } from "node:path";
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

export async function loadBeirCorpusDocuments(dataset, dataDir = null) {
  const directory = dataDir || dataset.dataDir;
  const content = await readFile(join(directory, "corpus.jsonl"), "utf8");
  return parseBeirCorpus(content);
}

export async function loadEvaluationCases(dataset, { dataDir = null, queriesPath = null } = {}) {
  if (dataset.family === "beir") {
    const directory = dataDir || dataset.dataDir;
    const queries = parseBeirQueries(await readFile(join(directory, "queries.jsonl"), "utf8"));
    const qrels = parseBeirQrels(await readFile(join(directory, `qrels/${dataset.qrelsSplit}.tsv`), "utf8"));
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
