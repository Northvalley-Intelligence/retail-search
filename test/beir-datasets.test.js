import assert from "node:assert/strict";
import test from "node:test";
import { deflateRawSync } from "node:zlib";
import {
  buildBeirBm25SearchBody,
  buildBeirBulkPayload,
  buildBeirEvaluationQueries,
  buildBeirIndexBody,
  parseBeirCorpus,
  parseBeirQueries,
  parseBeirQrels,
  parseBeirSearchResponse
} from "../src/datasets/beir.js";
import { DATASETS, getDataset, listDatasets } from "../src/datasets/registry.js";
import { extractZipEntries } from "../src/datasets/zip.js";

function buildZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const [name, content] of files) {
    const nameBuffer = Buffer.from(name, "utf8");
    const data = Buffer.from(content, "utf8");
    const compressed = deflateRawSync(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    localParts.push(local, nameBuffer, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);

    offset += 30 + nameBuffer.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

test("parses BEIR corpus, queries, and qrels formats", () => {
  const corpus = parseBeirCorpus('{"_id":"d1","title":"T1","text":"body one"}\n{"_id":"d2","title":"","text":"body two"}\n');
  assert.equal(corpus.length, 2);
  assert.deepEqual(corpus[0], { id: "d1", title: "T1", text: "body one" });

  const queries = parseBeirQueries('{"_id":"q1","text":"first query"}\n{"_id":"q2","text":"second query"}\n');
  assert.equal(queries.length, 2);
  assert.deepEqual(queries[1], { id: "q2", query: "second query" });

  const qrels = parseBeirQrels("query-id\tcorpus-id\tscore\nq1\td1\t1\nq1\td2\t2\nq2\td2\t0\n");
  assert.deepEqual(qrels.q1, { d1: 1, d2: 2 });
  assert.deepEqual(qrels.q2, { d2: 0 });
});

test("builds evaluation queries restricted to the qrels split", () => {
  const queries = [
    { id: "q1", query: "first" },
    { id: "q2", query: "second" },
    { id: "q3", query: "train-only, not in test qrels" }
  ];
  const qrels = { q2: { d1: 1 }, q1: { d2: 2 } };
  const cases = buildBeirEvaluationQueries(queries, qrels);
  assert.deepEqual(
    cases.map((testCase) => testCase.id),
    ["q1", "q2"]
  );
  assert.deepEqual(cases[0].qrels, { d2: 2 });
  assert.throws(() => buildBeirEvaluationQueries([], { q9: { d1: 1 } }), /unknown query/u);
});

test("builds BEIR index body, bulk payload, and BM25 search body", () => {
  const indexBody = buildBeirIndexBody();
  assert.equal(indexBody.mappings.properties.title.analyzer, "beir_english");
  assert.equal(indexBody.mappings.properties.text.analyzer, "beir_english");

  const payload = buildBeirBulkPayload([{ id: "d1", title: "T", text: "B" }], {
    index: "beir-scifact-v0",
    datasetId: "beir/scifact"
  });
  const lines = payload.trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(lines[0].index._id, "d1");
  assert.equal(lines[1].dataset, "beir/scifact");

  const body = buildBeirBm25SearchBody("aerodynamic heating", 10);
  assert.equal(body.size, 10);
  assert.equal(body.query.multi_match.type, "best_fields");
  assert.deepEqual(body.query.multi_match.fields, ["title", "text"]);
  assert.equal(body.query.multi_match.tie_breaker, 0.5);
});

test("parses OpenSearch hits into id/score results", () => {
  const results = parseBeirSearchResponse({
    hits: { hits: [{ _id: "d2", _score: 3.2 }, { _id: "d1", _score: 1.1 }] }
  });
  assert.deepEqual(results, [
    { id: "d2", score: 3.2 },
    { id: "d1", score: 1.1 }
  ]);
});

test("registry exposes the tiered BEIR scope plus Cranfield", () => {
  const datasets = listDatasets();
  assert.ok(datasets.length >= 15);
  assert.equal(getDataset("cranfield").family, "cranfield");
  assert.equal(getDataset("beir/scifact").tier, 1);
  assert.equal(getDataset("beir/scifact").publishedBm25NdcgAt10, 0.665);
  assert.equal(getDataset("beir/nfcorpus").publishedBm25NdcgAt10, 0.325);
  assert.equal(getDataset("beir/msmarco").qrelsSplit, "dev");
  assert.equal(DATASETS["beir/scifact"].relevanceMode, "linear");
  assert.throws(() => getDataset("beir/unknown"), /Unknown dataset/u);
});

test("registry models self-hit exclusion and CQADupStack sub-forums", () => {
  assert.equal(getDataset("beir/arguana").ignoreIdenticalIds, true);
  assert.equal(getDataset("beir/quora").ignoreIdenticalIds, true);
  assert.equal(getDataset("beir/scifact").ignoreIdenticalIds, false);

  const aggregate = getDataset("beir/cqadupstack");
  assert.equal(aggregate.aggregateOnly, true);
  assert.equal(aggregate.subDatasets.length, 12);

  const forum = getDataset("beir/cqadupstack/android");
  assert.equal(forum.fetchVia, "beir/cqadupstack");
  assert.equal(forum.downloadUrl, null);
  assert.equal(forum.dataDir, "data/beir/cqadupstack/android");
  assert.equal(forum.defaultIndex, "beir-cqadupstack-android-v0");
});

test("extracts deflated zip entries via the central directory", () => {
  const archive = buildZip([
    ["scifact/corpus.jsonl", '{"_id":"d1","title":"T","text":"B"}\n'],
    ["scifact/qrels/test.tsv", "query-id\tcorpus-id\tscore\nq1\td1\t1\n"]
  ]);
  const entries = extractZipEntries(archive);
  assert.equal(entries.size, 2);
  const corpus = parseBeirCorpus(entries.get("scifact/corpus.jsonl").toString("utf8"));
  assert.equal(corpus[0].id, "d1");
  const qrels = parseBeirQrels(entries.get("scifact/qrels/test.tsv").toString("utf8"));
  assert.deepEqual(qrels.q1, { d1: 1 });
});
