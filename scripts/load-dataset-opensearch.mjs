import { createReadStream } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { buildBeirBulkPayload, buildBeirIndexBody, parseBeirCorpus } from "../src/datasets/beir.js";
import { getDataset } from "../src/datasets/registry.js";
import { buildOpenSearchHeaders } from "../src/opensearch.js";
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

// Streams the corpus file and bulk-indexes in chunks; Tier 3 corpora hold
// millions of documents and must never be materialized in memory at once.
async function streamBulkLoad(env, dataset, index, chunkSize, onProgress) {
  let pending = [];
  let indexed = 0;
  // Free-tier instances throw transient 429/503s and connection resets under
  // sustained bulk load; retry with backoff instead of abandoning a long run.
  const BACKOFF_MS = [2000, 5000, 15000, 30000, 60000];
  const flush = async () => {
    if (!pending.length) {
      return;
    }
    const body = buildBeirBulkPayload(pending, { index, datasetId: dataset.id });
    for (let attempt = 0; ; attempt += 1) {
      try {
        const loaded = await request(env, "/_bulk", { method: "POST", body });
        if (!loaded.response.ok || loaded.payload.errors) {
          throw new Error(
            `Bulk load failed: ${loaded.response.status} ${JSON.stringify(loaded.payload?.items?.find((item) => item.index?.error)?.index?.error || {}).slice(0, 200)}`
          );
        }
        break;
      } catch (error) {
        if (attempt >= BACKOFF_MS.length) {
          throw error;
        }
        console.error(`bulk attempt ${attempt + 1} failed (${error.message.slice(0, 120)}); retrying in ${BACKOFF_MS[attempt] / 1000}s`);
        await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS[attempt]));
      }
    }
    indexed += pending.length;
    pending = [];
    onProgress(indexed);
  };

  const lines = createInterface({
    input: createReadStream(join(dataset.dataDir, "corpus.jsonl")),
    crlfDelay: Infinity
  });
  for await (const line of lines) {
    if (!line) {
      continue;
    }
    pending.push(...parseBeirCorpus(line));
    if (pending.length >= chunkSize) {
      await flush();
    }
  }
  await flush();
  return indexed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dataset = getDataset(args.dataset);
  if (dataset.aggregateOnly) {
    throw new Error(`Dataset ${dataset.id} is an aggregate; load its sub-datasets: ${dataset.subDatasets.join(", ")}`);
  }
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

  let lastLogged = 0;
  const indexed = await streamBulkLoad(env, dataset, index, args.chunkSize, (count) => {
    if (count - lastLogged >= 100000) {
      lastLogged = count;
      console.error(`indexed ${count} documents into ${index}`);
    }
  });

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

  const stats = await request(env, `/${encodeURIComponent(index)}/_stats/store`, { method: "GET" });
  const storeBytes = stats.response.ok ? stats.payload?._all?.total?.store?.size_in_bytes ?? null : null;

  console.log(
    JSON.stringify(
      {
        status: "ok",
        dataset: dataset.id,
        action: "loaded",
        index,
        indexStatus,
        indexed,
        liveCount: counted.payload.count,
        storeBytes,
        storeMb: storeBytes === null ? null : Math.round((storeBytes / 1048576) * 10) / 10,
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
