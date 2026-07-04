import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { CRANFIELD_INDEX_BODY, DATASET_ID, DEFAULT_INDEX } from "../src/cranfield/schema.js";

const DOCUMENTS_PATH = new URL("../data/cranfield/sample-documents.jsonl", import.meta.url);
const INDEX_PATH = new URL("../opensearch/cranfield-index.json", import.meta.url);

function parseArgs(argv) {
  const args = { check: false, write: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--check") {
      args.check = true;
    } else if (value === "--write") {
      args.write = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

async function readDocuments() {
  const content = await readFile(DOCUMENTS_PATH, "utf8");
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function validateDocument(document) {
  for (const field of ["id", "dataset", "title", "abstract", "text", "source", "indexed_at"]) {
    if (!document[field]) {
      throw new Error(`Cranfield sample document ${document.id || "(missing id)"} is missing ${field}`);
    }
  }
  if (document.dataset !== DATASET_ID) {
    throw new Error(`Document ${document.id} has unexpected dataset ${document.dataset}`);
  }
}

function buildBulkPayload(documents) {
  return documents
    .flatMap((document) => [
      JSON.stringify({ index: { _index: DEFAULT_INDEX, _id: document.id } }),
      JSON.stringify(document)
    ])
    .join("\n")
    .concat("\n");
}

const args = parseArgs(process.argv.slice(2));
const documents = await readDocuments();
const checkedInIndex = JSON.parse(await readFile(INDEX_PATH, "utf8"));
documents.forEach(validateDocument);

if (JSON.stringify(CRANFIELD_INDEX_BODY) !== JSON.stringify(checkedInIndex)) {
  throw new Error("opensearch/cranfield-index.json does not match src/cranfield/schema.js");
}

if (args.write) {
  await mkdir(dirname(args.write), { recursive: true });
  await writeFile(args.write, buildBulkPayload(documents));
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      index: DEFAULT_INDEX,
      documentCount: documents.length,
      mappingFields: Object.keys(CRANFIELD_INDEX_BODY.mappings.properties),
      wrote: args.write || null
    },
    null,
    2
  )
);
