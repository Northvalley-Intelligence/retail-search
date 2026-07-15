// Generalized embedding-pipeline groundwork (M-0002.4 deliverable #5).
// Converts any BEIR dataset into the {id,title,text} documents.jsonl and
// [{id,query}] queries.json shapes that cache-cranfield-embeddings.mjs already
// consumes via --documents/--queries, restricting queries to the qrels split so
// only the evaluated queries are embedded. Streams the corpus for large tiers.
import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadBeirCorpusDocuments, loadEvaluationCases, resolveDataset } from "./lib/datasets.mjs";

function parseArgs(argv) {
  const args = { dataset: null, outDir: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--dataset") {
      args.dataset = argv[index + 1];
      index += 1;
    } else if (value === "--out-dir") {
      args.outDir = argv[index + 1];
      index += 1;
    }
  }
  if (!args.dataset) {
    throw new Error("--dataset is required, e.g. --dataset beir/nfcorpus");
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dataset = resolveDataset(args.dataset);
  if (dataset.family !== "beir") {
    throw new Error("Only BEIR datasets need conversion; Cranfield already ships the embed-ready shape.");
  }
  const outDir = args.outDir || join("experiments", dataset.id.replace("beir/", "beir/"), "embedding-input");
  const documentsPath = join(outDir, "documents.jsonl");
  const queriesPath = join(outDir, "queries.json");
  await mkdir(dirname(documentsPath), { recursive: true });

  // Documents: stream to disk so multi-million-doc corpora never sit in memory.
  const documents = await loadBeirCorpusDocuments(dataset);
  const stream = createWriteStream(documentsPath);
  let documentCount = 0;
  for (const document of documents) {
    stream.write(`${JSON.stringify({ id: document.id, title: document.title, text: document.text })}\n`);
    documentCount += 1;
  }
  await new Promise((resolve, reject) => {
    stream.end((error) => (error ? reject(error) : resolve()));
  });

  // Queries: only the qrels split gets embedded.
  const cases = await loadEvaluationCases(dataset, {});
  const queries = cases.map((testCase) => ({ id: testCase.id, query: testCase.query }));
  await writeFile(queriesPath, `${JSON.stringify(queries, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        status: "ok",
        dataset: dataset.id,
        documents: documentCount,
        queries: queries.length,
        qrelsSplit: dataset.qrelsSplit,
        outputs: { documents: documentsPath, queries: queriesPath }
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.log(JSON.stringify({ status: "blocked", reason: "embedding_input_prep_failed", message: error.message }, null, 2));
  process.exit(1);
});
