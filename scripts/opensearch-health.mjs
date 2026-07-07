import { buildOpenSearchHeaders } from "../src/opensearch.js";
import { mergedEnv } from "./lib/local-env.mjs";

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

function buildUrl(baseUrl, pathname) {
  return `${String(baseUrl).replace(/\/+$/u, "")}${pathname}`;
}

async function requestJson(env, pathname) {
  const response = await fetch(buildUrl(env.OPENSEARCH_URL, pathname), {
    headers: buildOpenSearchHeaders(env)
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }
  return { response, payload };
}

async function main() {
  const env = mergedEnv();
  requireConfig(env);

  const info = await requestJson(env, "/");
  const health = await requestJson(env, "/_cluster/health");

  if (!info.response.ok || !health.response.ok) {
    console.log(
      JSON.stringify(
        {
          status: "blocked",
          infoStatus: info.response.status,
          healthStatus: health.response.status,
          valuesPrinted: false
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        status: "ok",
        distribution: info.payload.version?.distribution || "unknown",
        version: info.payload.version?.number || null,
        clusterHealth: health.payload.status || null,
        nodeCount: health.payload.number_of_nodes ?? null,
        activeShards: health.payload.active_shards ?? null,
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
        reason: "opensearch_health_check_failed",
        errorCode: error.cause?.code || error.code || null,
        valuesPrinted: false
      },
      null,
      2
    )
  );
  process.exit(1);
});
