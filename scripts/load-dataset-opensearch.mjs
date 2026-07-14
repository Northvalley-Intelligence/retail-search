import { buildBeirBulkPayload, buildBeirIndexBody } from "../src/datasets/beir.js";
import { getDataset } from "../src/datasets/registry.js";
import { buildOpenSearchHeaders } from "../src/opensearch.js";
import { loadBeirCorpusDocuments } from "./lib/datasets.mjs";
import { mergedEnv } from "./lib/local-env.mjs";

function parseArgs(argv) {
  const args = { dataset: null, index: null, drop: false, chunkSize: 500 };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--dataset") {
      args.dataset = argv[index + 1];
      index += 1;
    } else if (value === "--index") {
      args.index = argv[index + 1];
      index += 1;
    } else if (value === "--drop") {
      args.drop = true;
    } else if (value === "--chunk-size") {
      args.chunkSize = Number(argv[index + 1]);
      index += 1;
    }
  }
  if (!args.dataset) {
    throw new Error("--dataset is required, e.g. --dataset beir/scifact");
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

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dataset = getDataset(args.dataset);
  const env = mergedEnv();
  requireConfig(env);
  const index = args.index || dataset.defaultIndex;

  if (args.drop) {
    const dropped = await request(env, `/${encodeURIComponent(index)}`, { method: "DELETE" });
    console.log(
      JSON.stringify(
        {
          status: dropped.response.ok || dropped.response.status === 404 ? "ok" : "blocked",
          dataset: dataset.id,
          action: "dropped",
          index,
          httpStatus: dropped.response.status
        },
        null,
        2
      )
    );
    return;
  }

  const documents = await loadBeirCorpusDocuments(dataset);

  const exists = await fetch(buildUrl(env, `/${encodeURIComponent(index)}`), {
    method: "HEAD",
    headers: buildOpenSearchHeaders(env)
  });
  let indexStatus = "existing";
  if (exists.status === 404) {
    const created = await request(env, `/${encodeURIComponent(index)}`, {
      method: "PUT",
      body: JSON.stringify(buildBeirIndexBody())
    });
    if (!created.response.ok) {
      throw new Error(`Index create failed: ${created.response.status}`);
    }
    indexStatus = "created";
  } else if (exists.status !== 200) {
    throw new Error(`Index existence check failed: ${exists.status}`);
  }

  let indexed = 0;
  for (const documentsChunk of chunk(documents, args.chunkSize)) {
    const loaded = await request(env, "/_bulk", {
      method: "POST",
      body: buildBeirBulkPayload(documentsChunk, { index, datasetId: dataset.id })
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

  const counted = await request(env, `/${encodeURIComponent(index)}/_count`, {
    method: "POST",
    body: JSON.stringify({ query: { term: { dataset: dataset.id } } })
  });
  if (!counted.response.ok) {
    throw new Error(`Document count failed: ${counted.response.status}`);
  }

  console.log(
    JSON.stringify(
      {
        status: "ok",
        dataset: dataset.id,
        action: "loaded",
        index,
        indexStatus,
        documents: documents.length,
        indexed,
        liveCount: counted.payload.count,
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
        reason: "dataset_load_failed",
        message: error.message.replace(/https?:\/\/\S+/gu, "<redacted-url>"),
        valuesPrinted: false
      },
      null,
      2
    )
  );
  process.exit(1);
});
