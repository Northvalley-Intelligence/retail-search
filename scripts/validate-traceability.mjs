import { readFile } from "node:fs/promises";

const REQUIRED_IDS = ["M-0001", "A-0002", "SE-0001", "ARCH-0.1", "ADL-0001", "v0.1.0"];

const REQUIRED_FILES = [
  ".mde/traceability.json",
  "docs/traceability.md",
  "docs/missions/M-0001-cranfield-foundation.md",
  "docs/articles/A-0002-baseline-before-agents.md",
  "docs/evolution/timeline.md",
  "docs/evolution/experiments/SE-0001-cranfield-baseline.md",
  "docs/architecture/timeline.md",
  "docs/architecture/versions/ARCH-0.1-cranfield-baseline.md",
  "docs/architecture/decisions/ADL-0001-cranfield-opensearch-baseline.md",
  "docs/endpoints/ARCH-0.1-endpoints.md"
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
