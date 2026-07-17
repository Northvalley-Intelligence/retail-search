// Portfolio scope classification (M-0002.3 -> M-0002.6 preview).
// Combines every evaluated technique across the Cranfield+Tier1 superset into one
// Technique x Dataset table, each cell a relative delta vs that dataset's lexical
// baseline, and applies the Superset-Not-Filter policy per technique.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const UNIVERSAL_MIN_IMPROVE_RATE = 0.7;
const MAX_RELATIVE_REGRESSION = 0.05;
const DOMAIN_CONDITIONAL_MIN = 2;

// Cranfield lexical technique deltas come from the field-sum offline artifacts;
// Cranfield BGE hybrid comes from the GEN-023 remote validation (documented).
const SUPERSET = [
  { id: "cranfield", dir: "../cranfield-v0" },
  { id: "beir/scifact", dir: "scifact" },
  { id: "beir/nfcorpus", dir: "nfcorpus" },
  { id: "beir/fiqa", dir: "fiqa" },
  { id: "beir/arguana", dir: "arguana" },
  { id: "beir/scidocs", dir: "scidocs" }
];

async function readJsonIfExists(path) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch { return null; }
}

function ndcg(ev) { return ev?.metrics?.ndcgAtK ?? null; }

function classify(rows) {
  const evaluated = rows.filter((r) => r.relativeDelta !== null);
  const improved = evaluated.filter((r) => r.relativeDelta > 0);
  const worst = Math.min(0, ...evaluated.map((r) => r.relativeDelta));
  const rate = evaluated.length ? improved.length / evaluated.length : 0;
  let scope = "dormant";
  if (rate >= UNIVERSAL_MIN_IMPROVE_RATE && worst >= -MAX_RELATIVE_REGRESSION) scope = "universal";
  else if (improved.length >= DOMAIN_CONDITIONAL_MIN) scope = "domain-conditional";
  return { scope, evaluated: evaluated.length, improved: improved.length, improveRate: Math.round(rate * 1000) / 1000, worstRelativeRegression: Math.round(worst * 1000) / 1000, improvedOn: improved.map((r) => r.id) };
}

function rel(technique, baseline) {
  if (technique === null || baseline === null || baseline === 0) return null;
  return Math.round(((technique - baseline) / baseline) * 10000) / 10000;
}

async function main() {
  const base = "experiments/beir";
  const techniques = { "coverage-rerank": [], "prf-rerank": [], "bge-hybrid": [], "ltr-bge": [] };

  for (const { id, dir } of SUPERSET) {
    // Lexical baseline + coverage/prf from field-sum offline artifacts.
    const fs0 = await readJsonIfExists(join(base, dir, "evaluation-fieldsum-first-stage-offline-gen028.json"));
    const cov = await readJsonIfExists(join(base, dir, "evaluation-fieldsum-coverage-rerank-offline-gen028.json"));
    const prf = await readJsonIfExists(join(base, dir, "evaluation-fieldsum-prf-rerank-offline-gen028.json"));
    const lexBase = ndcg(fs0);
    techniques["coverage-rerank"].push({ id, baseline: lexBase, technique: ndcg(cov), relativeDelta: rel(ndcg(cov), lexBase) });
    techniques["prf-rerank"].push({ id, baseline: lexBase, technique: ndcg(prf), relativeDelta: rel(ndcg(prf), lexBase) });

    // BGE hybrid: artifact carries its own lexical (BM25) baseline + best hybrid.
    const bge = await readJsonIfExists(join(base, dir, "evaluation-bge-hybrid-gen029.json"));
    let bgeHybridNdcg = null;
    if (bge) {
      bgeHybridNdcg = bge.best?.metrics?.ndcgAtK ?? null;
      techniques["bge-hybrid"].push({ id, baseline: bge.lexicalBaseline, technique: bgeHybridNdcg, relativeDelta: rel(bgeHybridNdcg, bge.lexicalBaseline), variant: bge.best?.label });
    } else if (id === "cranfield") {
      bgeHybridNdcg = 0.3533;
      techniques["bge-hybrid"].push({ id, baseline: 0.3022, technique: 0.3533, relativeDelta: rel(0.3533, 0.3022), variant: "remote-hybrid-gen023" });
    } else {
      techniques["bge-hybrid"].push({ id, baseline: null, technique: null, relativeDelta: null });
    }

    // LTR (BGE features): classified against its lexical baseline, but the
    // decision-relevant comparison is vs plain BGE hybrid (Occam rule).
    const ltr = await readJsonIfExists(join(base, dir, "evaluation-ltr-bge-gen029.json"));
    if (ltr) {
      techniques["ltr-bge"].push({ id, baseline: ltr.firstStageNdcg, technique: ltr.ltrCvNdcg, relativeDelta: rel(ltr.ltrCvNdcg, ltr.firstStageNdcg), variant: "boosted-trees-cv", vsHybrid: ltr.bgeHybridNdcg, beatsHybrid: ltr.ltrBeatsHybrid });
    } else if (id === "cranfield") {
      // GEN-022 documented: BGE boosted-tree LTR CV 0.3603 vs hybrid 0.3533.
      techniques["ltr-bge"].push({ id, baseline: 0.3022, technique: 0.3603, relativeDelta: rel(0.3603, 0.3022), variant: "boosted-trees-cv-gen022", vsHybrid: 0.3533, beatsHybrid: true });
    } else {
      techniques["ltr-bge"].push({ id, baseline: null, technique: null, relativeDelta: null });
    }
  }

  const output = {
    generatedAt: "2026-07-16T00:00:00.000Z",
    note: "Superset scope classification over Cranfield+Tier1. Deltas are vs each dataset's lexical baseline. NOTE on ltr-bge: its scope is shown vs the BM25 baseline (where it improves everywhere), but the DECISION-relevant comparison is the Occam check vs plain BGE hybrid - LTR wins only 2/4, so it is a PORTFOLIO technique, not core (ADL-0007). BGE hybrid is the ARCH-0.5 core (ADL-0006). Tier 2-3 dense/LTR and fiqa/scidocs LTR deferred.",
    policy: { universal: ">=70% improved, no >5% relative regression", domainConditional: ">=2 improved", dormant: "<2 improved" },
    techniques: Object.fromEntries(Object.entries(techniques).map(([name, rows]) => [name, { classification: classify(rows), perDataset: rows }]))
  };
  await writeFile(join(base, "portfolio-classification.json"), `${JSON.stringify(output, null, 2)}\n`);

  for (const [name, t] of Object.entries(output.techniques)) {
    const c = t.classification;
    console.log(`\n${name}: ${c.scope.toUpperCase()} (improved ${c.improved}/${c.evaluated}, worst ${(c.worstRelativeRegression * 100).toFixed(1)}%)`);
    for (const r of t.perDataset) {
      if (r.relativeDelta === null) { console.log(`  ${r.id.padEnd(16)} (pending)`); continue; }
      const s = r.relativeDelta > 0 ? "+" : "";
      const occam = r.vsHybrid != null ? `  vs hybrid ${r.vsHybrid} => ${r.beatsHybrid ? "LTR wins" : "hybrid wins"}` : "";
      console.log(`  ${r.id.padEnd(16)} ${String(r.baseline).padEnd(7)} -> ${String(r.technique).padEnd(7)} ${s}${(r.relativeDelta * 100).toFixed(1)}%${r.variant ? "  [" + r.variant + "]" : ""}${occam}`);
    }
  }

  // Occam summary: LTR only becomes core if it beats plain BGE hybrid cross-domain.
  const ltrRows = output.techniques["ltr-bge"].perDataset.filter((r) => r.beatsHybrid != null);
  const ltrWins = ltrRows.filter((r) => r.beatsHybrid).length;
  console.log(`\nOccam check (LTR vs plain BGE hybrid): LTR wins ${ltrWins}/${ltrRows.length} => ${ltrWins / ltrRows.length >= 0.7 ? "LTR could be core" : "BGE hybrid stays core, LTR is portfolio (simpler wins)"}`);
  console.log(`\nwrote ${join(base, "portfolio-classification.json")}`);
}

main().catch((e) => { console.log(JSON.stringify({ status: "blocked", reason: "portfolio_classification_failed", message: e.message })); process.exit(1); });
