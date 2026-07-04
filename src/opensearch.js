import { SearchConfigurationError, SearchUpstreamError } from "./errors.js";

function getBase64Encoder() {
  if (typeof btoa === "function") {
    return btoa;
  }
  return (value) => Buffer.from(value, "utf8").toString("base64");
}

export function getOpenSearchIndex(env = {}, fallbackIndex) {
  return env.CRANFIELD_INDEX || fallbackIndex;
}

export function getOpenSearchUrl(env = {}, index) {
  const baseUrl = env.OPENSEARCH_URL;
  if (!baseUrl) {
    throw new SearchConfigurationError("OPENSEARCH_URL is required for live search");
  }

  const cleanBaseUrl = String(baseUrl).replace(/\/+$/, "");
  return `${cleanBaseUrl}/${encodeURIComponent(index)}/_search`;
}

export function buildOpenSearchHeaders(env = {}) {
  const headers = {
    accept: "application/json",
    "content-type": "application/json"
  };

  if (env.OPENSEARCH_API_KEY) {
    headers.authorization = `ApiKey ${env.OPENSEARCH_API_KEY}`;
    return headers;
  }

  if (env.OPENSEARCH_USERNAME && env.OPENSEARCH_PASSWORD) {
    const encode = getBase64Encoder();
    headers.authorization = `Basic ${encode(`${env.OPENSEARCH_USERNAME}:${env.OPENSEARCH_PASSWORD}`)}`;
  }

  return headers;
}

export async function executeOpenSearchSearch({ env = {}, index, body, fetchImpl }) {
  const searchUrl = getOpenSearchUrl(env, index);
  const transport = fetchImpl || env.OPENSEARCH_FETCH || fetch;

  if (typeof transport !== "function") {
    throw new SearchConfigurationError("fetch transport is unavailable for OpenSearch search");
  }

  const response = await transport(searchUrl, {
    method: "POST",
    headers: buildOpenSearchHeaders(env),
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new SearchUpstreamError("OpenSearch returned invalid JSON", {
      status: response.status,
      bodyPreview: text.slice(0, 200),
      cause: error.message
    });
  }

  if (!response.ok) {
    throw new SearchUpstreamError("OpenSearch search request failed", {
      status: response.status,
      payload
    });
  }

  return payload;
}

