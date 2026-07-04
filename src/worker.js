import { ValidationError } from "./errors.js";
import { explainCranfield } from "./cranfield/explain.js";
import { searchCranfield } from "./cranfield/search.js";
import { parseResultSize } from "./cranfield/schema.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type, authorization"
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: JSON_HEADERS
  });
}

function getSize(searchParams) {
  return parseResultSize(searchParams.get("size"), 10);
}

function isSearchPath(pathname) {
  return pathname === "/api/cranfield/search" || pathname === "/api/v0/search" || pathname === "/api/search";
}

function isExplainPath(pathname) {
  return pathname === "/api/cranfield/explain" || pathname === "/api/v0/explain" || pathname === "/api/explain";
}

function errorStatus(error) {
  if (error instanceof ValidationError) {
    return error.status;
  }
  return error.status || 500;
}

function errorPayload(error) {
  return {
    error: {
      code: error.code || "internal_error",
      message: error.message,
      details: error.details || undefined
    }
  };
}

export default {
  async fetch(request, env = {}) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: JSON_HEADERS });
    }

    if (request.method !== "GET") {
      return jsonResponse({ error: { code: "method_not_allowed", message: "Only GET is supported" } }, 405);
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === "/health") {
        return jsonResponse({
          status: "ok",
          service: "retail-search",
          architectureVersion: env.ARCHITECTURE_VERSION || "v0-cranfield-opensearch-baseline"
        });
      }

      if (isSearchPath(url.pathname)) {
        const response = await searchCranfield({
          query: url.searchParams.get("q"),
          size: getSize(url.searchParams),
          env
        });
        return jsonResponse(response);
      }

      if (isExplainPath(url.pathname)) {
        const response = await explainCranfield({
          query: url.searchParams.get("q"),
          size: getSize(url.searchParams),
          env
        });
        return jsonResponse(response);
      }

      return jsonResponse({ error: { code: "not_found", message: "Unknown endpoint" } }, 404);
    } catch (error) {
      return jsonResponse(errorPayload(error), errorStatus(error));
    }
  }
};

