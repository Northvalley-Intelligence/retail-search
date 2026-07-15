// Technique x Dataset evidence matrix (M-0002.3 central artifact).
// Collates offline reranker evaluations against the BM25 first-stage baseline per
// dataset, and previews scope classification (Universal / Domain-conditional /
// Dormant) under the Mission Update 002 policy. Purely reads written artifacts.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const EXPERIMENTS_DIR = "experiments/beir";

// Techniques evaluated over the field-sum first stage -- the Phase 1 native config,
// so Cranfield and BEIR compare like-for-like across the superset. Each dataset's
// delta is measured against its OWN first stage, so the mixed relevance modes
// (Cranfield graded, BEIR linear) do not distort the per-dataset comparison.
const TECHNIQUES = ["coverage-rerank", "prf-rerank"];
const FIRST_STAGE_FILE = "evaluation-fieldsum-first-stage-offline-gen028.json";
const techniqueFile = (technique) => `evaluation-fieldsum-${technique}-offline-gen028.json`;

// The superset spans Cranfield (Phase 1 foundation) plus the BEIR datasets.
const SUPERSET = [
  { datasetId: "cranfield", dir: "../cranfield-v0" },
  { datasetId: "beir/scifact", dir: "scifact" },
  { datasetId: "beir/nfcorpus", dir: "nfcorpus" },
  { datasetId: "beir/fiqa", dir: "fiqa" },
  { datasetId: "beir/arguana", dir: "arguana" },
  { datasetId: "beir/scidocs", dir: "scidocs" }
];

// Universal bar (Mission Update 002): improves >=70% of evaluated datasets and no
// dataset regresses more than 5% relative. Domain-conditional: improves >=2. Else dormant.
const UNIVERSAL_MIN_IMPROVE_RATE = 0.7;
const MAX_RELATIVE_REGRESSION = 0.05;
const DOMAIN_CONDITIONAL_MIN = 2;

async function readJsonIfExists(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

function ndcg(evaluation) {
  return evaluation?.metrics?.ndcgAtK ?? null;
}

function classify(perDataset) {
  const evaluated = perDataset.filter((row) => row.baseline !== null && row.technique !== null);
  const improvements = evaluated.filter((row) => row.relativeDelta > 0);
  const worstRegression = Math.min(0, ...evaluated.map((row) => row.relativeDelta));
  const improveRate = evaluated.length ? improvements.length / evaluated.length : 0;

  let scope = "dormant";
  if (improveRate >= UNIVERSAL_MIN_IMPROVE_RATE && worstRegression >= -MAX_RELATIVE_REGRESSION) {
    scope = "universal";
  } else if (improvements.length >= DOMAIN_CONDITIONAL_MIN) {
    scope = "domain-conditional";
  }
  return {
    scope,
    datasetsEvaluated: evaluated.length,
    datasetsImproved: improvements.length,
    improveRate: Math.round(improveRate * 1000) / 1000,
    worstRelativeRegression: Math.round(worstRegression * 1000) / 1000,
    improvedOn: improvements.map((row) => row.dataset)
  };
}

async function main() {
  const rowsByTechnique = Object.fromEntries(TECHNIQUES.map((t) => [t, []]));

  for (const { datasetId, dir } of SUPERSET) {
    const baseline = await readJsonIfExists(join(EXPERIMENTS_DIR, dir, FIRST_STAGE_FILE));
    const baselineNdcg = ndcg(baseline);
    if (baselineNdcg === null) {
      continue;
    }
    for (const technique of TECHNIQUES) {
      const evaluation = await readJsonIfExists(join(EXPERIMENTS_DIR, dir, techniqueFile(technique)));
      const value = ndcg(evaluation);
      const relativeDelta = value === null ? null : Math.round(((value - baselineNdcg) / baselineNdcg) * 10000) / 10000;
      rowsByTechnique[technique].push({
        dataset: datasetId,
        baseline: baselineNdcg,
        technique: value,
        absoluteDelta: value === null ? null : Math.round((value - baselineNdcg) * 10000) / 10000,
        relativeDelta
      });
    }
  }

  const techniques = TECHNIQUES.map((technique) => ({
    technique,
    firstStage: "field-sum (Phase 1 native config)",
    classificationPreview: classify(rowsByTechnique[technique]),
    perDataset: rowsByTechnique[technique]
  }));

  const output = {
    generatedAt: "2026-07-15T00:00:00.000Z",
    note: "M-0002.3 lexical rerank technique matrix over the field-sum first stage, across the Cranfield+Tier1 superset. BGE hybrid and LTR columns pending the embedding pipeline (M-0002.4); Tier 2-3 rerank columns pending one pool-caching pass. Classification is a PREVIEW over currently-evaluated datasets, not the final Phase 2 scope decision.",
    policy: {
      universal: "improves >=70% of evaluated datasets, no dataset regresses >5% relative",
      domainConditional: "improves >=2 datasets but misses the universal bar",
      dormant: "improves <2 datasets"
    },
    techniques
  };

  const outPath = join(EXPERIMENTS_DIR, "technique-matrix.json");
  await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`);

  for (const t of techniques) {
    const c = t.classificationPreview;
    console.log(`${t.technique}: ${c.scope} (improved ${c.datasetsImproved}/${c.datasetsEvaluated}, worst regression ${(c.worstRelativeRegression * 100).toFixed(1)}%)`);
    for (const row of t.perDataset) {
      const sign = row.relativeDelta > 0 ? "+" : "";
      console.log(`  ${row.dataset.padEnd(24)} base ${row.baseline}  tech ${row.technique}  ${sign}${(row.relativeDelta * 100).toFixed(1)}%`);
    }
  }
  console.log(`\nwrote ${outPath}`);
}

main().catch((error) => {
  console.log(JSON.stringify({ status: "blocked", reason: "technique_matrix_failed", message: error.message }, null, 2));
  process.exit(1);
});
