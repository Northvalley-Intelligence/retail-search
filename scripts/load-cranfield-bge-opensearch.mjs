import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { buildOpenSearchHeaders } from "../src/opensearch.js";
import { CRANFIELD_INDEX_BODY } from "../src/cranfield/schema.js";
import { mergedEnv } from "./lib/local-env.mjs";

const DEFAULT_DOCUMENTS = "/private/tmp/retail-search-cranfield-live/documents.jsonl";
const DEFAULT_EMBEDDINGS = "experiments/cranfield-v0/embeddings-huggingface-bge-base-en-v15-title-abstract-gen022.json";
const DEFAULT_INDEX = "cranfield-v0-bge-base-en-v15-gen023";

function parseArgs(argv) {
  const args = {
    documents: DEFAULT_DOCUMENTS,
    embeddings: DEFAULT_EMBEDDINGS,
    index: DEFAULT_INDEX,
    write: null,
    vectorField: "bge_embedding",
    chunkSize: 100,
    summary: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--documents") {
      args.documents = argv[index + 1];
      index += 1;
    } else if (value === "--embeddings") {
      args.embeddings = argv[index + 1];
      index += 1;
    } else if (value === "--index") {
      args.index = argv[index + 1];
      index += 1;
    } else if (value === "--write") {
      args.write = argv[index + 1];
      index += 1;
    } else if (value === "--vector-field") {
      args.vectorField = argv[index + 1];
      index += 1;
    } else if (value === "--chunk-size") {
      args.chunkSize = Number(argv[index + 1]);
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

async function readJsonl(path) {
  const content = await readFile(path, "utf8");
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function bgeIndexBody(dimension, vectorField) {
  return {
    settings: {
      ...CRANFIELD_INDEX_BODY.settings,
      index: {
        ...CRANFIELD_INDEX_BODY.settings.index,
        knn: true
      }
    },
    mappings: {
      dynamic: "strict",
      properties: {
        ...CRANFIELD_INDEX_BODY.mappings.properties,
        [vectorField]: {
          type: "knn_vector",
          dimension,
          method: {
            name: "hnsw",
            engine: "lucene",
            space_type: "cosinesimil"
          }
        }
      }
    }
  };
}

async function ensureIndex(env, index, body) {
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
    body: JSON.stringify(body)
  });
  if (!created.response.ok) {
    throw new Error(`Index create failed: ${created.response.status} ${JSON.stringify(created.payload).slice(0, 500)}`);
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

function bulkPayload(index, documents, embeddingsById, vectorField) {
  return documents
    .flatMap((document) => {
      const embedding = embeddingsById.get(String(document.id))?.embedding;
      if (!embedding) {
        throw new Error(`Missing embedding for document ${document.id}`);
      }
      return [
        JSON.stringify({ index: { _index: index, _id: document.id } }),
        JSON.stringify({
          ...document,
          [vectorField]: embedding
        })
      ];
    })
    .join("\n")
    .concat("\n");
}

async function bulkLoad(env, index, documents, embeddingsById, args) {
  let indexed = 0;
  for (const documentsChunk of chunk(documents, Math.max(1, Number(args.chunkSize) || 1))) {
    const loaded = await request(env, "/_bulk", {
      method: "POST",
      body: bulkPayload(index, documentsChunk, embeddingsById, args.vectorField)
    });
    if (!loaded.response.ok || loaded.payload.errors) {
      throw new Error(`Bulk load failed: ${loaded.response.status} ${JSON.stringify(loaded.payload).slice(0, 500)}`);
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

  const [documents, embeddings] = await Promise.all([
    readJsonl(args.documents),
    JSON.parse(await readFile(args.embeddings, "utf8"))
  ]);
  const dimension = embeddings.dimension || embeddings.documents?.[0]?.embedding?.length;
  if (!dimension) {
    throw new Error("Embedding artifact did not include a dimension");
  }
  const embeddingsById = new Map(embeddings.documents.map((row) => [String(row.id), row]));
  const missingCount = documents.filter((document) => !embeddingsById.has(String(document.id))).length;
  if (missingCount) {
    throw new Error(`Embedding artifact is missing ${missingCount} document embeddings`);
  }

  const indexBody = bgeIndexBody(dimension, args.vectorField);
  const indexStatus = await ensureIndex(env, args.index, indexBody);
  const indexed = await bulkLoad(env, args.index, documents, embeddingsById, args);
  const liveCount = await countDocuments(env, args.index);
  const output = {
    generatedAt: new Date().toISOString(),
    dataset: "cranfield",
    transport: "live-opensearch-bge-vector-load",
    index: args.index,
    indexStatus,
    vectorField: args.vectorField,
    embeddingSource: args.embeddings,
    embeddingProvider: embeddings.provider,
    embeddingModel: embeddings.model,
    embeddingDimension: dimension,
    documentsSource: args.documents,
    documentCount: documents.length,
    indexed,
    liveCount,
    indexBody,
    valuesPrinted: false
  };

  await mkdir(dirname(args.write), { recursive: true });
  await writeFile(args.write, `${JSON.stringify(output, null, 2)}\n`);

  console.log(
    JSON.stringify(
      args.summary
        ? {
            generatedAt: output.generatedAt,
            status: "ok",
            index: output.index,
            indexStatus: output.indexStatus,
            vectorField: output.vectorField,
            embeddingModel: output.embeddingModel,
            embeddingDimension: output.embeddingDimension,
            documentCount: output.documentCount,
            indexed: output.indexed,
            liveCount: output.liveCount,
            wrote: args.write,
            valuesPrinted: false
          }
        : output,
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
        reason: "cranfield_bge_live_load_failed",
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
