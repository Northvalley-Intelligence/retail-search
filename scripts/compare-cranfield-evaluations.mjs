import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

function parseArgs(argv) {
  const args = {
    baseline: null,
    candidates: [],
    write: null,
    summary: false,
    top: 10
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--baseline") {
      args.baseline = argv[index + 1];
      index += 1;
    } else if (value === "--candidate") {
      args.candidates.push(argv[index + 1]);
      index += 1;
    } else if (value === "--write") {
      args.write = argv[index + 1];
      index += 1;
    } else if (value === "--summary") {
      args.summary = true;
    } else if (value === "--top") {
      args.top = Number(argv[index + 1]);
      index += 1;
    }
  }

  if (!args.baseline || args.candidates.length === 0) {
    throw new Error("--baseline and at least one --candidate are required");
  }

  return args;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

function metricDeltas(baseline, candidate) {
  return Object.fromEntries(
    Object.keys(baseline.metrics).map((name) => [name, round(candidate.metrics[name] - baseline.metrics[name])])
  );
}

function groupCounts(artifact) {
  return Object.fromEntries(artifact.failureAnalysis.groups.map((group) => [group.id, group.queryCount]));
}

function groupDeltas(baseline, candidate) {
  const baselineGroups = groupCounts(baseline);
  const candidateGroups = groupCounts(candidate);
  const groupIds = new Set([...Object.keys(baselineGroups), ...Object.keys(candidateGroups)]);
  return Array.from(groupIds)
    .map((id) => ({
      id,
      baselineCount: baselineGroups[id] || 0,
      candidateCount: candidateGroups[id] || 0,
      delta: (candidateGroups[id] || 0) - (baselineGroups[id] || 0)
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.id.localeCompare(b.id));
}

function perQueryMap(artifact) {
  const perQuery = artifact.failureAnalysis.perQuery;
  if (!Array.isArray(perQuery)) {
    throw new Error(`${artifact.searchArchitecture?.id || artifact.architectureVersion} does not include failureAnalysis.perQuery; rerun with --details`);
  }
  return new Map(perQuery.map((query) => [query.queryId, query]));
}

function queryDeltas(baseline, candidate, top) {
  const baselineQueries = perQueryMap(baseline);
  const candidateQueries = perQueryMap(candidate);
  const rows = [];

  for (const [queryId, baselineQuery] of baselineQueries) {
    const candidateQuery = candidateQueries.get(queryId);
    if (!candidateQuery) {
      continue;
    }
    rows.push({
      queryId,
      query: baselineQuery.query,
      baselineGroup: baselineQuery.behaviorGroup,
      candidateGroup: candidateQuery.behaviorGroup,
      ndcgDelta: round(candidateQuery.metrics.ndcgAtK - baselineQuery.metrics.ndcgAtK),
      averagePrecisionDelta: round(candidateQuery.metrics.averagePrecision - baselineQuery.metrics.averagePrecision),
      reciprocalRankDelta: round(candidateQuery.metrics.reciprocalRank - baselineQuery.metrics.reciprocalRank),
      recallDelta: round(candidateQuery.metrics.recallAtK - baselineQuery.metrics.recallAtK),
      baselineNdcgAtK: baselineQuery.metrics.ndcgAtK,
      candidateNdcgAtK: candidateQuery.metrics.ndcgAtK
    });
  }

  const improved = rows.filter((row) => row.ndcgDelta > 0);
  const worsened = rows.filter((row) => row.ndcgDelta < 0);
  const unchanged = rows.length - improved.length - worsened.length;

  return {
    improvedCount: improved.length,
    worsenedCount: worsened.length,
    unchangedCount: unchanged,
    topImproved: rows
      .slice()
      .sort((a, b) => b.ndcgDelta - a.ndcgDelta || b.averagePrecisionDelta - a.averagePrecisionDelta)
      .slice(0, top),
    topWorsened: rows
      .slice()
      .sort((a, b) => a.ndcgDelta - b.ndcgDelta || a.averagePrecisionDelta - b.averagePrecisionDelta)
      .slice(0, top)
  };
}

function decisionFromDeltas(deltas) {
  const improved = deltas.map > 0 && deltas.ndcgAtK > 0 && deltas.recallAtK > 0 && deltas.mrr > 0;
  const regressed = deltas.map < 0 && deltas.ndcgAtK < 0 && deltas.recallAtK < 0 && deltas.mrr < 0;
  if (improved) return "candidate_improved_core_metrics";
  if (regressed) return "candidate_regressed_core_metrics";
  return "candidate_mixed_metrics";
}

function summarizeArtifact(path, artifact) {
  return {
    artifact: path,
    architectureVersion: artifact.architectureVersion,
    searchArchitecture: artifact.searchArchitecture,
    metrics: artifact.metrics,
    failureGroups: artifact.failureAnalysis.groups
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseline = await readJson(args.baseline);
  const candidates = await Promise.all(args.candidates.map(async (path) => ({ path, artifact: await readJson(path) })));

  const output = {
    generatedAt: new Date().toISOString(),
    dataset: baseline.dataset,
    k: baseline.evaluation.k,
    retrieveSize: baseline.retrieveSize || baseline.evaluation.k,
    baseline: summarizeArtifact(args.baseline, baseline),
    candidates: candidates.map(({ path, artifact }) => {
      const deltas = metricDeltas(baseline, artifact);
      return {
        ...summarizeArtifact(path, artifact),
        metricDeltas: deltas,
        groupDeltas: groupDeltas(baseline, artifact),
        queryDeltas: queryDeltas(baseline, artifact, args.top),
        decision: decisionFromDeltas(deltas)
      };
    })
  };

  if (args.write) {
    await mkdir(dirname(args.write), { recursive: true });
    await writeFile(args.write, `${JSON.stringify(output, null, 2)}\n`);
  }

  console.log(
    JSON.stringify(
      args.summary
        ? {
            generatedAt: output.generatedAt,
            dataset: output.dataset,
            k: output.k,
            retrieveSize: output.retrieveSize,
            baseline: {
              artifact: output.baseline.artifact,
              architecture: output.baseline.searchArchitecture.id,
              metrics: output.baseline.metrics
            },
            candidates: output.candidates.map((candidate) => ({
              artifact: candidate.artifact,
              architecture: candidate.searchArchitecture.id,
              metrics: candidate.metrics,
              metricDeltas: candidate.metricDeltas,
              decision: candidate.decision,
              queryDeltas: {
                improvedCount: candidate.queryDeltas.improvedCount,
                worsenedCount: candidate.queryDeltas.worsenedCount,
                unchangedCount: candidate.queryDeltas.unchangedCount
              }
            })),
            wrote: args.write || null
          }
        : output,
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
        reason: "cranfield_evaluation_comparison_failed",
        message: error.message
      },
      null,
      2
    )
  );
  process.exit(1);
});
