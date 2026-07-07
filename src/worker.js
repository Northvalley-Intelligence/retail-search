import { ValidationError } from "./errors.js";
import { explainCranfield } from "./cranfield/explain.js";
import { CRANFIELD_EVALUATION_PROFILE } from "./cranfield/evaluation-profile.js";
import { searchCranfield } from "./cranfield/search.js";
import { DATASET_PROFILE, parseResultSize } from "./cranfield/schema.js";
import { traceabilityPayload } from "./traceability.js";
import { renderCranfieldPage, renderHomePage, renderPlannedPhasePage } from "./ui.js";

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

function htmlResponse(markup, status = 200) {
  return new Response(markup, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60"
    }
  });
}

function getSize(searchParams) {
  return parseResultSize(searchParams.get("size"), 10);
}

function isSearchPath(pathname) {
  return pathname === "/api/cranfield/search" || pathname === "/api/v0/search" || pathname === "/api/v0.1/search" || pathname === "/api/search";
}

function isExplainPath(pathname) {
  return pathname === "/api/cranfield/explain" || pathname === "/api/v0/explain" || pathname === "/api/v0.1/explain" || pathname === "/api/explain";
}

function isDatasetProfilePath(pathname) {
  return pathname === "/api/cranfield/meta" || pathname === "/api/datasets/cranfield" || pathname === "/api/dataset";
}

function isEvaluationPath(pathname) {
  return pathname === "/api/cranfield/evaluation" || pathname === "/api/evaluation";
}

function cranfieldSection(pathname) {
  const aliases = new Map([
    ["/phases/cranfield", "overview"],
    ["/phase-1", "overview"],
    ["/phases/cranfield/search", "search"],
    ["/phase-1/search", "search"],
    ["/phases/cranfield/data", "data"],
    ["/phase-1/data", "data"],
    ["/phases/cranfield/explain", "explain"],
    ["/phase-1/explain", "explain"],
    ["/phases/cranfield/evaluation", "evaluation"],
    ["/phase-1/evaluation", "evaluation"]
  ]);
  return aliases.get(pathname);
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
      if (url.pathname === "/" || url.pathname === "/index.html") {
        return htmlResponse(renderHomePage());
      }

      const phaseSection = cranfieldSection(url.pathname);
      if (phaseSection) {
        return htmlResponse(renderCranfieldPage(phaseSection));
      }

      if (url.pathname === "/phases/beir") {
        return htmlResponse(renderPlannedPhasePage("phase-2"));
      }

      if (url.pathname === "/phases/esci") {
        return htmlResponse(renderPlannedPhasePage("phase-3"));
      }

      if (url.pathname === "/phases/behavior") {
        return htmlResponse(renderPlannedPhasePage("phase-4"));
      }

      if (url.pathname === "/health") {
        return jsonResponse({
          status: "ok",
          service: "retail-search",
          architectureVersion: env.ARCHITECTURE_VERSION || "v0-cranfield-opensearch-baseline",
          traceability: traceabilityPayload(env)
        });
      }

      if (isDatasetProfilePath(url.pathname)) {
        return jsonResponse({
          ...DATASET_PROFILE,
          traceability: traceabilityPayload(env)
        });
      }

      if (isEvaluationPath(url.pathname)) {
        return jsonResponse({
          ...CRANFIELD_EVALUATION_PROFILE,
          traceability: traceabilityPayload(env)
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
