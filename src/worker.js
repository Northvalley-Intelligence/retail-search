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

function getArchitecture(searchParams) {
  return searchParams.get("architecture") || undefined;
}

const MILESTONE_ALIASES = {
  "arch-0.1": {
    id: "arch-0.1",
    label: "ARCH-0.1 OpenSearch BM25 baseline",
    searchEvolutionId: "SE-0001",
    architectureVersion: "ARCH-0.1",
    architecture: "baseline",
    status: "released-baseline",
    resultSummary: {
      ndcgAt10: 0.2995
    }
  },
  "arch-0.2-prf": {
    id: "arch-0.2-prf",
    label: "ARCH-0.2 candidate refined PRF rerank",
    searchEvolutionId: "SE-0002",
    architectureVersion: "ARCH-0.2-candidate",
    architecture: "prf-rerank",
    status: "candidate-transferability-pending",
    resultSummary: {
      ndcgAt10: 0.326,
      binaryNdcgAt20: 0.4563
    }
  },
  "arch-0.3-bge": {
    id: "arch-0.3-bge",
    label: "ARCH-0.3 candidate BGE vector hybrid",
    searchEvolutionId: "SE-0003",
    architectureVersion: "ARCH-0.3-candidate",
    architecture: "bge-vector-hybrid",
    status: "candidate-runtime-not-enabled",
    resultSummary: {
      ndcgAt10: 0.3533,
      binaryNdcgAt20: 0.4926
    },
    remoteIndex: "cranfield-v0-bge-base-en-v15-gen023",
    validatedArtifacts: [
      "experiments/cranfield-v0/evaluation-live-opensearch-bge-base-en-v15-gen023.json",
      "experiments/cranfield-v0/evaluation-live-opensearch-bge-base-en-v15-k20-binary-gen023.json"
    ]
  }
};

const ARCH_0_3_BGE_DEMO_SAMPLES = {
  all: [
    {
      sampleId: "1",
      queryId: "1",
      label: "Aeroelastic similarity laws",
      query:
        "what similarity laws must be obeyed when constructing aeroelastic models of heated high speed aircraft .",
      metrics: {
        precisionAtK: 0.6,
        recallAtK: 0.2143,
        averagePrecision: 0.144,
        reciprocalRank: 0.5,
        ndcgAtK: 0.3007
      }
    },
    {
      sampleId: "3",
      queryId: "3",
      label: "Composite slab heat conduction",
      query: "what problems of heat conduction in composite slabs have been solved so far .",
      metrics: {
        precisionAtK: 0.7,
        recallAtK: 0.875,
        averagePrecision: 0.8207,
        reciprocalRank: 1,
        ndcgAtK: 0.9021
      }
    },
    {
      sampleId: "9",
      queryId: "9",
      label: "Slip flow heat transfer",
      query: "papers on internal /slip flow/ heat transfer studies .",
      metrics: {
        precisionAtK: 0.3,
        recallAtK: 1,
        averagePrecision: 1,
        reciprocalRank: 1,
        ndcgAtK: 1
      }
    }
  ]
};

const MILESTONE_ID_ALIASES = {
  "v0.1": "arch-0.1",
  baseline: "arch-0.1",
  prf: "arch-0.2-prf",
  "prf-rerank": "arch-0.2-prf",
  bge: "arch-0.3-bge",
  "vector-hybrid": "arch-0.3-bge"
};

function resolveMilestone(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return MILESTONE_ALIASES[MILESTONE_ID_ALIASES[normalized] || normalized] || null;
}

function milestoneRoute(pathname) {
  const match = pathname.match(/^\/api\/milestones\/([^/]+)\/(search|explain|demo)$/u);
  if (!match) {
    return null;
  }
  return {
    milestone: resolveMilestone(decodeURIComponent(match[1])),
    action: match[2]
  };
}

function milestonePayload(milestone) {
  return {
    id: milestone.id,
    label: milestone.label,
    searchEvolutionId: milestone.searchEvolutionId,
    architectureVersion: milestone.architectureVersion,
    architecture: milestone.architecture,
    status: milestone.status,
    resultSummary: milestone.resultSummary,
    remoteIndex: milestone.remoteIndex,
    validatedArtifacts: milestone.validatedArtifacts
  };
}

function bgeMilestoneUnavailablePayload(milestone, action, env) {
  return {
    error: {
      code: "milestone_runtime_not_enabled",
      message:
        "ARCH-0.3 BGE vector hybrid is validated as a remote OpenSearch candidate, but this Worker endpoint does not yet have runtime query-vector generation enabled."
    },
    milestone: milestonePayload(milestone),
    requestedAction: action,
    traceability: traceabilityPayload(env),
    supportedNow: [
      "/api/milestones/arch-0.1/search",
      "/api/milestones/arch-0.1/explain",
      "/api/milestones/arch-0.2-prf/search",
      "/api/milestones/arch-0.2-prf/explain"
    ],
    nextImplementationStep:
      "Add a runtime query-vector provider or a bounded known-query embedding cache before enabling arbitrary BGE milestone search and explain."
  };
}

function bgeMilestoneDemoPayload(milestone, sample) {
  const selectedSample =
    !sample || sample === "all"
      ? ARCH_0_3_BGE_DEMO_SAMPLES.all
      : ARCH_0_3_BGE_DEMO_SAMPLES.all.filter((item) => item.sampleId === sample || item.queryId === sample);
  if (sample && !selectedSample.length) {
    return null;
  }

  return {
    demoMode: "archived_evaluation_samples",
    requestedAction: "demo",
    sourceArtifact: "experiments/cranfield-v0/evaluation-live-opensearch-bge-base-en-v15-gen023.json",
    archivedValidation: {
      generationId: "GEN-023",
      searchEvolutionId: "SE-0003",
      architectureVersion: "ARCH-0.3-candidate",
      index: milestone.remoteIndex
    },
    milestone: milestonePayload(milestone),
    sampleCount: selectedSample.length,
    samples: selectedSample.map((item) => ({
      ...item,
      note: "Archived remote OpenSearch BGE hybrid sample from GEN-023; live arbitrary-query runtime is still disabled."
    })),
    nextImplementationStep:
      "Enable runtime query-vector generation or a bounded known-query embedding cache before treating ARCH-0.3 as live search."
  };
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

      const requestedMilestone = milestoneRoute(url.pathname);
      if (requestedMilestone) {
        if (!requestedMilestone.milestone) {
          return jsonResponse(
            {
              error: {
                code: "unknown_milestone",
                message: "Milestone must be arch-0.1, arch-0.2-prf, or arch-0.3-bge."
              }
            },
            404
          );
        }

        if (requestedMilestone.milestone.id === "arch-0.3-bge" && requestedMilestone.action === "demo") {
          const payload = bgeMilestoneDemoPayload(requestedMilestone.milestone, url.searchParams.get("sample"));
          if (!payload) {
            return jsonResponse(
              {
                error: {
                  code: "unknown_demo_sample",
                  message: "ARCH-0.3 demo samples are 1, 3, 9, or all."
                }
              },
              404
            );
          }
          return jsonResponse(payload);
        }

        if (requestedMilestone.action === "demo") {
          return jsonResponse(
            {
              error: {
                code: "demo_not_available",
                message: "ARCH-0.3 demo samples are only exposed for the BGE milestone."
              }
            },
            404
          );
        }

        if (requestedMilestone.milestone.id === "arch-0.3-bge") {
          return jsonResponse(bgeMilestoneUnavailablePayload(requestedMilestone.milestone, requestedMilestone.action, env), 501);
        }

        const handler = requestedMilestone.action === "search" ? searchCranfield : explainCranfield;
        const response = await handler({
          query: url.searchParams.get("q"),
          size: getSize(url.searchParams),
          env,
          architecture: requestedMilestone.milestone.architecture
        });
        return jsonResponse({
          ...response,
          milestone: milestonePayload(requestedMilestone.milestone)
        });
      }

      if (isSearchPath(url.pathname)) {
        const response = await searchCranfield({
          query: url.searchParams.get("q"),
          size: getSize(url.searchParams),
          env,
          architecture: getArchitecture(url.searchParams)
        });
        return jsonResponse(response);
      }

      if (isExplainPath(url.pathname)) {
        const response = await explainCranfield({
          query: url.searchParams.get("q"),
          size: getSize(url.searchParams),
          env,
          architecture: getArchitecture(url.searchParams)
        });
        return jsonResponse(response);
      }

      return jsonResponse({ error: { code: "not_found", message: "Unknown endpoint" } }, 404);
    } catch (error) {
      return jsonResponse(errorPayload(error), errorStatus(error));
    }
  }
};
