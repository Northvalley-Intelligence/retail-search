import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  buildCranfieldBulkPayload,
  CRANFIELD_SOURCE,
  parseCranfieldArchive
} from "../src/cranfield/corpus.js";
import { ARCHITECTURE_VERSION, DEFAULT_INDEX } from "../src/cranfield/schema.js";

const DEFAULT_OUT_DIR = "data/cranfield/full";
const DEFAULT_BULK_PATH = "experiments/cranfield-v0/cranfield-full-bulk.ndjson";
const DEFAULT_INDEXED_AT = "2026-07-04T00:00:00.000Z";

function parseArgs(argv) {
  const args = {
    archive: null,
    bulk: DEFAULT_BULK_PATH,
    outDir: DEFAULT_OUT_DIR,
    source: CRANFIELD_SOURCE.url,
    index: DEFAULT_INDEX,
    indexedAt: DEFAULT_INDEXED_AT,
    skipChecksum: false,
    writeBulk: true
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--archive") {
      args.archive = argv[index + 1];
      index += 1;
    } else if (value === "--bulk") {
      args.bulk = argv[index + 1];
      args.writeBulk = Boolean(args.bulk);
      index += 1;
    } else if (value === "--index") {
      args.index = argv[index + 1];
      index += 1;
    } else if (value === "--indexed-at") {
      args.indexedAt = argv[index + 1];
      index += 1;
    } else if (value === "--out-dir") {
      args.outDir = argv[index + 1];
      index += 1;
    } else if (value === "--source") {
      args.source = argv[index + 1];
      index += 1;
    } else if (value === "--skip-checksum") {
      args.skipChecksum = true;
    } else if (value === "--no-bulk") {
      args.writeBulk = false;
    }
  }

  return args;
}

async function readArchive(args) {
  if (args.archive) {
    return readFile(args.archive);
  }

  const response = await fetch(args.source);
  if (!response.ok) {
    throw new Error(`Failed to download Cranfield archive: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function md5(buffer) {
  return createHash("md5").update(buffer).digest("hex");
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeJsonl(path, values) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, values.map((value) => JSON.stringify(value)).join("\n").concat("\n"));
}

const args = parseArgs(process.argv.slice(2));
const archive = await readArchive(args);
const checksum = md5(archive);

const acceptedChecksums = [
  CRANFIELD_SOURCE.expectedMd5,
  CRANFIELD_SOURCE.expectedDecodedTarMd5
].filter(Boolean);

if (!args.skipChecksum && args.source === CRANFIELD_SOURCE.url && !acceptedChecksums.includes(checksum)) {
  throw new Error(`Unexpected Cranfield archive checksum: ${checksum}`);
}

const parsed = parseCranfieldArchive(archive, { indexedAt: args.indexedAt });
const documentsPath = join(args.outDir, "documents.jsonl");
const queriesPath = join(args.outDir, "queries.json");
const qrelsPath = join(args.outDir, "qrels.jsonl");

await writeJsonl(documentsPath, parsed.documents);
await writeJson(queriesPath, parsed.evaluationQueries);
await writeJsonl(qrelsPath, parsed.qrels);

if (args.writeBulk) {
  await mkdir(dirname(args.bulk), { recursive: true });
  await writeFile(args.bulk, buildCranfieldBulkPayload(parsed.documents, { index: args.index }));
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      dataset: CRANFIELD_SOURCE.irDatasetsId,
      architectureVersion: ARCHITECTURE_VERSION,
      source: args.source,
      checksum,
      counts: parsed.counts,
      outputs: {
        documents: documentsPath,
        queries: queriesPath,
        qrels: qrelsPath,
        bulk: args.writeBulk ? args.bulk : null
      }
    },
    null,
    2
  )
);
