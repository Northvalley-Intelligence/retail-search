import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getDataset } from "../src/datasets/registry.js";

const EXPERIMENTS_DIR = "experiments/beir";

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function latestEvaluation(directory) {
  let entries;
  try {
    entries = await readdir(directory);
  } catch {
    return null;
  }
  const candidates = entries.filter((name) => /^evaluation-bm25(-aggregate)?-gen\d+\.json$/u.test(name)).sort();
  if (!candidates.length) {
    return null;
  }
  const aggregate = candidates.find((name) => name.includes("aggregate"));
  return readJson(join(directory, aggregate || candidates[candidates.length - 1]));
}

function row(datasetId, evaluation) {
  if (!evaluation) {
    return { dataset: datasetId, status: "pending" };
  }
  const reference = evaluation.referenceComparison || null;
  const measured = evaluation.metrics.ndcgAtK ?? evaluation.metrics.ndcgAt10Average;
  return {
    dataset: datasetId,
    tier: getDataset(datasetId).tier,
    status: "measured",
    queries: evaluation.evaluation?.queryCount ?? evaluation.totalQueries ?? null,
    bm25NdcgAt10: measured,
    published: reference?.published ?? null,
    relativeDelta: reference?.relativeDelta ?? null
  };
}

async function main() {
  const datasetIds = [
    "beir/scifact",
    "beir/nfcorpus",
    "beir/fiqa",
    "beir/arguana",
    "beir/scidocs",
    "beir/trec-covid",
    "beir/webis-touche2020",
    "beir/cqadupstack",
    "beir/quora",
    "beir/nq",
    "beir/hotpotqa",
    "beir/dbpedia-entity",
    "beir/msmarco",
    "beir/climate-fever",
    "beir/fever"
  ];

  const rows = [];
  for (const datasetId of datasetIds) {
    const directory = join(EXPERIMENTS_DIR, datasetId.replace("beir/", ""));
    rows.push(row(datasetId, await latestEvaluation(directory)));
  }

  const measured = rows.filter((entry) => entry.status === "measured");
  const output = {
    generatedAt: "2026-07-14T00:00:00.000Z",
    technique: "bm25-multi-match",
    harness: "dataset-agnostic-v1",
    measuredCount: measured.length,
    pendingCount: rows.length - measured.length,
    averageBm25NdcgAt10: measured.length
      ? Math.round((measured.reduce((sum, entry) => sum + entry.bm25NdcgAt10, 0) / measured.length) * 10000) / 10000
      : null,
    publishedAverageReference: "BM25 (Anserini/ES class) averages ~0.43 across public BEIR datasets",
    rows
  };

  const outPath = join(EXPERIMENTS_DIR, "baseline-matrix.json");
  await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.log(JSON.stringify({ status: "blocked", reason: "matrix_report_failed", message: error.message }, null, 2));
  process.exit(1);
});
