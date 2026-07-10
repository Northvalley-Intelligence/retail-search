import { readFile } from "node:fs/promises";

const REQUIRED_IDS = [
  "M-0001",
  "A-0002",
  "SE-0001",
  "ARCH-0.1",
  "ADL-0001",
  "v0.1.0",
  "SE-0002",
  "ARCH-0.2-candidate",
  "ADL-0002",
  "GEN-013",
  "GEN-014",
  "GEN-015",
  "GEN-016",
  "GEN-017",
  "GEN-018",
  "GEN-019",
  "GEN-020",
  "GEN-021",
  "GEN-022",
  "GEN-023",
  "GEN-024",
  "GEN-025",
  "retrieval-pools-field-sum-top50-gen017",
  "SE-0003",
  "ARCH-0.3-candidate",
  "ADL-0003",
  "embeddings-local-hash-gen018",
  "evaluation-vector-local-hash-gen018",
  "embeddings-ollama-llama31-8b-title-abstract-gen019",
  "evaluation-vector-ollama-llama31-8b-title-abstract-gen019",
  "embeddings-huggingface-bge-base-en-v15-title-abstract-gen022",
  "evaluation-vector-huggingface-bge-base-en-v15-depth100-gen022",
  "load-opensearch-bge-base-en-v15-gen023",
  "evaluation-live-opensearch-bge-base-en-v15-gen023",
  "evaluation-live-opensearch-bge-base-en-v15-k20-binary-gen023",
  "/api/milestones/arch-0.1/search",
  "/api/milestones/arch-0.2-prf/search",
  "/api/milestones/arch-0.3-bge/search",
  "SE-0004",
  "ARCH-0.4-candidate",
  "ADL-0004",
  "evaluation-ltr-lexical-features-gen020",
  "evaluation-ltr-ollama-features-gen020",
  "evaluation-ltr-boosted-trees-depth3-gen021",
  "evaluation-ltr-boosted-trees-huggingface-bge-base-en-v15-features-gen022",
  "prf-rerank"
];

const REQUIRED_FILES = [
  ".mde/traceability.json",
  "docs/traceability.md",
  "docs/missions/M-0001-cranfield-foundation.md",
  "docs/articles/A-0002-baseline-before-agents.md",
  "docs/evolution/timeline.md",
  "docs/evolution/experiments/SE-0001-cranfield-baseline.md",
  "docs/evolution/experiments/SE-0002-cranfield-field-sum.md",
  "docs/evolution/experiments/SE-0003-cranfield-vector-hybrid.md",
  "docs/evolution/experiments/SE-0004-cranfield-ltr.md",
  "docs/architecture/timeline.md",
  "docs/architecture/versions/ARCH-0.1-cranfield-baseline.md",
  "docs/architecture/versions/ARCH-0.2-candidate-cranfield-field-sum.md",
  "docs/architecture/versions/ARCH-0.3-candidate-cranfield-vector-hybrid.md",
  "docs/architecture/versions/ARCH-0.4-candidate-cranfield-ltr.md",
  "docs/architecture/decisions/ADL-0001-cranfield-opensearch-baseline.md",
  "docs/architecture/decisions/ADL-0002-cranfield-field-sum-candidate.md",
  "docs/architecture/decisions/ADL-0003-cranfield-vector-hybrid-candidate.md",
  "docs/architecture/decisions/ADL-0004-cranfield-ltr-candidate.md",
  "docs/endpoints/ARCH-0.1-endpoints.md",
  "docs/endpoints/milestone-endpoints.md",
  "docs/evaluation/cranfield-failure-groups.md",
  "docs/evaluation/cranfield-prf-rerank-research.md",
  "docs/evaluation/cranfield-vector-hybrid-research.md",
  "docs/evaluation/cranfield-ltr-research.md",
  "docs/evaluation/timeline.md",
  "experiments/cranfield-v0/README.md",
  "MISSION_UPDATES.md",
  ".mde/generation-summary.md"
];

async function read(path) {
  return readFile(path, "utf8");
}

const registry = JSON.parse(await read(".mde/traceability.json"));

const expectedRegistry = {
  mission_id: "M-0001",
  article_id: "A-0002",
  search_evolution_id: "SE-0001",
  architecture_version: "ARCH-0.1",
  architecture_decision_id: "ADL-0001",
  git_tag: "v0.1.0",
  search_endpoint: "/api/v0.1/search",
  explain_endpoint: "/api/v0.1/explain"
};

for (const [key, expected] of Object.entries(expectedRegistry)) {
  if (registry.current_chain?.[key] !== expected) {
    throw new Error(`Traceability registry ${key} expected ${expected} but found ${registry.current_chain?.[key]}`);
  }
}

const expectedExperiments = {
  "SE-0001": {
    architecture_version: "ARCH-0.1",
    architecture_decision_id: "ADL-0001"
  },
  "SE-0002": {
    architecture_version: "ARCH-0.2-candidate",
    architecture_decision_id: "ADL-0002"
  },
  "SE-0003": {
    architecture_version: "ARCH-0.3-candidate",
    architecture_decision_id: "ADL-0003"
  },
  "SE-0004": {
    architecture_version: "ARCH-0.4-candidate",
    architecture_decision_id: "ADL-0004"
  }
};

for (const [experimentId, expected] of Object.entries(expectedExperiments)) {
  const experiment = registry.experiments?.[experimentId];
  if (!experiment) {
    throw new Error(`Traceability registry missing experiment ${experimentId}`);
  }
  for (const [key, value] of Object.entries(expected)) {
    if (experiment[key] !== value) {
      throw new Error(`Traceability registry ${experimentId}.${key} expected ${value} but found ${experiment[key]}`);
    }
  }
}

const allContent = [];
for (const path of REQUIRED_FILES) {
  allContent.push(await read(path));
}

const combinedContent = allContent.join("\n");
for (const id of REQUIRED_IDS) {
  if (!combinedContent.includes(id)) {
    throw new Error(`Traceability docs are missing id ${id}`);
  }
}

const endpointDoc = await read("docs/endpoints/ARCH-0.1-endpoints.md");
for (const endpoint of ["/api/v0.1/search", "/api/v0.1/explain"]) {
  if (!endpointDoc.includes(endpoint)) {
    throw new Error(`Endpoint manifest missing ${endpoint}`);
  }
}

const milestoneEndpointDoc = await read("docs/endpoints/milestone-endpoints.md");
for (const endpoint of [
  "/api/milestones/arch-0.1/search",
  "/api/milestones/arch-0.1/explain",
  "/api/milestones/arch-0.2-prf/search",
  "/api/milestones/arch-0.2-prf/explain",
  "/api/milestones/arch-0.3-bge/search",
  "/api/milestones/arch-0.3-bge/explain"
]) {
  if (!milestoneEndpointDoc.includes(endpoint)) {
    throw new Error(`Milestone endpoint manifest missing ${endpoint}`);
  }
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      checkedFiles: REQUIRED_FILES.length,
      ids: REQUIRED_IDS
    },
    null,
    2
  )
);
