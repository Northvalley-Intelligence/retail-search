import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  buildCranfieldBulkPayload,
  CRANFIELD_SOURCE,
  parseCranfieldArchive
} from "../src/cranfield/corpus.js";
import { CRANFIELD_INDEX_BODY, DEFAULT_INDEX } from "../src/cranfield/schema.js";
import { buildOpenSearchHeaders } from "../src/opensearch.js";
import { mergedEnv } from "./lib/local-env.mjs";

const DEFAULT_EXPORT_DIR = "/private/tmp/retail-search-cranfield-live";
const DEFAULT_BULK_PATH = "/private/tmp/retail-search-cranfield-live/cranfield-full-bulk.ndjson";
const DEFAULT_INDEXED_AT = "2026-07-04T00:00:00.000Z";

function parseArgs(argv) {
  const args = {
    index: null,
    outDir: DEFAULT_EXPORT_DIR,
    bulk: DEFAULT_BULK_PATH,
    source: CRANFIELD_SOURCE.url,
    indexedAt: DEFAULT_INDEXED_AT,
    chunkSize: 500
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--index") {
      args.index = argv[index + 1];
      index += 1;
    } else if (value === "--out-dir") {
      args.outDir = argv[index + 1];
      index += 1;
    } else if (value === "--bulk") {
      args.bulk = argv[index + 1];
      index += 1;
    } else if (value === "--source") {
      args.source = argv[index + 1];
      index += 1;
    } else if (value === "--chunk-size") {
      args.chunkSize = Number(argv[index + 1]);
      index += 1;
    }
  }

  return args;
}

function requireConfig(env) {
  const missing = [];
  if (!env.OPENSEARCH_URL) missing.push("OPENSEARCH_URL");
  if (!env.OPENSEARCH_API_KEY && !(env.OPENSEARCH_USERNAME && env.OPENSEARCH_PASSWORD)) {
    missing.push("OPENSEARCH_API_KEY or OPENSEARCH_USERNAME and OPENSEARCH_PASSWORD");
  }
  if (missing.length) {
    throw new Error(`Missing OpenSearch configuration: ${missing.join(", ")}`);
  }
}

function buildUrl(env, pathname) {
  return `${String(env.OPENSEARCH_URL).replace(/\/+$/u, "")}${pathname}`;
}

async function request(env, pathname, init = {}) {
  const response = await fetch(buildUrl(env, pathname), {
    ...init,
    headers: {
      ...buildOpenSearchHeaders(env),
      ...(init.headers || {})
    }
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text.slice(0, 200) };
  }
  return { response, payload };
}

async function downloadArchive(source) {
  const response = await fetch(source);
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

async function ensureIndex(env, index) {
  const exists = await fetch(buildUrl(env, `/${encodeURIComponent(index)}`), {
    method: "HEAD",
    headers: buildOpenSearchHeaders(env)
  });
  if (exists.status === 200) {
    return "existing";
  }
  if (exists.status !== 404) {
    throw new Error(`Index existence check failed: ${exists.status}`);
  }

  const created = await request(env, `/${encodeURIComponent(index)}`, {
    method: "PUT",
    body: JSON.stringify(CRANFIELD_INDEX_BODY)
  });
  if (!created.response.ok) {
    throw new Error(`Index create failed: ${created.response.status}`);
  }
  return "created";
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function bulkLoad(env, index, documents, chunkSize) {
  let indexed = 0;
  for (const documentsChunk of chunk(documents, chunkSize)) {
    const payload = buildCranfieldBulkPayload(documentsChunk, { index });
    const loaded = await request(env, "/_bulk", {
      method: "POST",
      body: payload
    });
    if (!loaded.response.ok || loaded.payload.errors) {
      throw new Error(`Bulk load failed: ${loaded.response.status}`);
    }
    indexed += documentsChunk.length;
  }

  const refresh = await request(env, `/${encodeURIComponent(index)}/_refresh`, { method: "POST" });
  if (!refresh.response.ok) {
    throw new Error(`Index refresh failed: ${refresh.response.status}`);
  }

  return indexed;
}

async function countDocuments(env, index) {
  const counted = await request(env, `/${encodeURIComponent(index)}/_count`, {
    method: "POST",
    body: JSON.stringify({ query: { term: { dataset: "cranfield" } } })
  });
  if (!counted.response.ok) {
    throw new Error(`Document count failed: ${counted.response.status}`);
  }
  return counted.payload.count;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = mergedEnv();
  requireConfig(env);
  const index = args.index || env.CRANFIELD_INDEX || DEFAULT_INDEX;

  const archive = await downloadArchive(args.source);
  const checksum = md5(archive);
  const parsed = parseCranfieldArchive(archive, { indexedAt: args.indexedAt });
  const documentsPath = join(args.outDir, "documents.jsonl");
  const queriesPath = join(args.outDir, "queries.json");
  const qrelsPath = join(args.outDir, "qrels.jsonl");

  await writeJsonl(documentsPath, parsed.documents);
  await writeJson(queriesPath, parsed.evaluationQueries);
  await writeJsonl(qrelsPath, parsed.qrels);
  await mkdir(dirname(args.bulk), { recursive: true });
  await writeFile(args.bulk, buildCranfieldBulkPayload(parsed.documents, { index }));

  const indexStatus = await ensureIndex(env, index);
  const indexed = await bulkLoad(env, index, parsed.documents, args.chunkSize);
  const liveCount = await countDocuments(env, index);

  console.log(
    JSON.stringify(
      {
        status: "ok",
        index,
        indexStatus,
        source: "public-cranfield",
        checksum,
        exported: parsed.counts,
        indexed,
        liveCount,
        outputs: {
          documents: documentsPath,
          queries: queriesPath,
          qrels: qrelsPath,
          bulk: args.bulk
        },
        valuesPrinted: false
      },
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
        reason: "cranfield_live_load_failed",
        errorCode: error.cause?.code || error.code || null,
        message: error.message.replace(/https?:\/\/\S+/gu, "<redacted-url>"),
        valuesPrinted: false
      },
      null,
      2
    )
  );
  process.exit(1);
});
