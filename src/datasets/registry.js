// Dataset registry for the dataset-agnostic evaluation harness (M-0002.1).
// Every dataset the project evaluates plugs in here; tiers follow Mission Update 002.
// Published BM25 reference numbers are nDCG@10 sanity-check targets from the BEIR
// paper / leaderboard — baselines landing far from them indicate a harness bug.

const BEIR_DOWNLOAD_BASE = "https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets";

function beirDataset(name, options = {}) {
  return {
    id: `beir/${name}`,
    family: "beir",
    beirName: name,
    tier: options.tier,
    defaultIndex: `beir-${name.replace(/\//gu, "-")}-v0`,
    dataDir: `data/beir/${name}`,
    downloadUrl: options.fetchVia ? null : `${BEIR_DOWNLOAD_BASE}/${name}.zip`,
    fetchVia: options.fetchVia || null,
    aggregateOnly: options.aggregateOnly || false,
    subDatasets: options.subDatasets || null,
    qrelsSplit: options.qrelsSplit || "test",
    // HEAD-checked archive size (GB) from the BEIR mirror; check before downloading,
    // and use curl-to-disk plus system unzip for anything near Node's buffer limits.
    downloadSizeGb: options.downloadSizeGb ?? null,
    relevanceMode: "linear",
    // BEIR's official evaluation drops results whose document id equals the
    // query id (matters for ArguAna and Quora, where queries live in the corpus).
    ignoreIdenticalIds: options.ignoreIdenticalIds || false,
    expectedCounts: options.expectedCounts || null,
    publishedBm25NdcgAt10: options.publishedBm25NdcgAt10 ?? null,
    licenseRestricted: false,
    notes: options.notes || null
  };
}

export const CQADUPSTACK_FORUMS = [
  "android",
  "english",
  "gaming",
  "gis",
  "mathematica",
  "physics",
  "programmers",
  "stats",
  "tex",
  "unix",
  "webmasters",
  "wordpress"
];

export const DATASETS = {
  cranfield: {
    id: "cranfield",
    family: "cranfield",
    tier: 0,
    defaultIndex: "cranfield-v0",
    dataDir: "data/cranfield",
    qrelsSplit: "all",
    relevanceMode: "graded",
    expectedCounts: { documents: 1400, queries: 225 },
    publishedBm25NdcgAt10: null,
    licenseRestricted: false,
    notes: "Phase 1 foundation dataset; searches run through the versioned Cranfield architectures."
  },
  "beir/scifact": beirDataset("scifact", {
    tier: 1,
    expectedCounts: { documents: 5183, queries: 300 },
    publishedBm25NdcgAt10: 0.665
  }),
  "beir/nfcorpus": beirDataset("nfcorpus", {
    tier: 1,
    expectedCounts: { documents: 3633, queries: 323 },
    publishedBm25NdcgAt10: 0.325
  }),
  "beir/fiqa": beirDataset("fiqa", {
    tier: 1,
    expectedCounts: { documents: 57638, queries: 648 },
    publishedBm25NdcgAt10: 0.236
  }),
  "beir/arguana": beirDataset("arguana", {
    tier: 1,
    ignoreIdenticalIds: true,
    expectedCounts: { documents: 8674, queries: 1406 },
    publishedBm25NdcgAt10: 0.472,
    notes:
      "Reference 0.472 is the Lucene-class BM25 reproduction with self-hits excluded (bm25s, 2024); the BEIR-paper 0.315 kept self-hits (our measured equivalent: 0.3521 via --include-identical-ids, GEN-028). 1298 of 1406 test queries exist as corpus documents."
  }),
  "beir/scidocs": beirDataset("scidocs", {
    tier: 1,
    expectedCounts: { documents: 25657, queries: 1000 },
    publishedBm25NdcgAt10: 0.158
  }),
  "beir/trec-covid": beirDataset("trec-covid", {
    tier: 2,
    expectedCounts: { documents: 171332, queries: 50 },
    publishedBm25NdcgAt10: 0.656
  }),
  "beir/webis-touche2020": beirDataset("webis-touche2020", {
    tier: 2,
    expectedCounts: { documents: 382545, queries: 49 },
    publishedBm25NdcgAt10: 0.367
  }),
  "beir/cqadupstack": beirDataset("cqadupstack", {
    downloadSizeGb: 4.98,
    tier: 2,
    aggregateOnly: true,
    subDatasets: CQADUPSTACK_FORUMS.map((forum) => `beir/cqadupstack/${forum}`),
    expectedCounts: null,
    publishedBm25NdcgAt10: 0.299,
    notes: "Aggregate of twelve sub-forums; the published number is the sub-forum average. Fetch this id, then load/evaluate the sub-datasets."
  }),
  ...Object.fromEntries(
    CQADUPSTACK_FORUMS.map((forum) => [
      `beir/cqadupstack/${forum}`,
      beirDataset(`cqadupstack/${forum}`, {
        tier: 2,
        fetchVia: "beir/cqadupstack",
        publishedBm25NdcgAt10: null,
        notes: "CQADupStack sub-forum; compare the twelve-forum average against the aggregate reference 0.299."
      })
    ])
  ),
  "beir/quora": beirDataset("quora", {
    tier: 2,
    ignoreIdenticalIds: true,
    expectedCounts: { documents: 522931, queries: 10000 },
    publishedBm25NdcgAt10: 0.789
  }),
  "beir/nq": beirDataset("nq", {
    downloadSizeGb: 0.46,
    tier: 3,
    expectedCounts: { documents: 2681468, queries: 3452 },
    publishedBm25NdcgAt10: 0.329
  }),
  "beir/hotpotqa": beirDataset("hotpotqa", {
    downloadSizeGb: 0.61,
    tier: 3,
    expectedCounts: { documents: 5233329, queries: 7405 },
    publishedBm25NdcgAt10: 0.603
  }),
  "beir/fever": beirDataset("fever", {
    downloadSizeGb: 1.15,
    tier: 3,
    expectedCounts: { documents: 5416568, queries: 6666 },
    publishedBm25NdcgAt10: 0.753
  }),
  "beir/climate-fever": beirDataset("climate-fever", {
    downloadSizeGb: 1.14,
    tier: 3,
    expectedCounts: { documents: 5416593, queries: 1535 },
    publishedBm25NdcgAt10: 0.213
  }),
  "beir/dbpedia-entity": beirDataset("dbpedia-entity", {
    downloadSizeGb: 0.60,
    tier: 3,
    expectedCounts: { documents: 4635922, queries: 400 },
    publishedBm25NdcgAt10: 0.313
  }),
  "beir/msmarco": beirDataset("msmarco", {
    downloadSizeGb: 1.01,
    tier: 3,
    qrelsSplit: "dev",
    expectedCounts: { documents: 8841823, queries: 6980 },
    publishedBm25NdcgAt10: 0.228,
    notes: "Evaluated on the dev split per published practice."
  })
};

export function getDataset(datasetId) {
  const dataset = DATASETS[datasetId];
  if (!dataset) {
    throw new Error(`Unknown dataset ${datasetId}; known datasets: ${Object.keys(DATASETS).join(", ")}`);
  }
  return dataset;
}

export function listDatasets() {
  return Object.values(DATASETS);
}
