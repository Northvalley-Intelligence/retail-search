import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCranfieldBulkPayload,
  buildCranfieldQueriesWithQrels,
  parseCranfieldDocuments,
  parseCranfieldQrels,
  parseCranfieldQueries
} from "../src/cranfield/corpus.js";

const docsFixture = `.I 1
.T
experimental investigation of the aerodynamics of a wing
.A
Smith, J.
.B
Journal of Aeronautics
.W
pressure distribution and boundary layer measurements are reported.
.I 2
.T
heat transfer in hypersonic flow
.A
Doe, A.
.B
Technical Report
.W
stagnation point heating is compared for blunt bodies.
`;

const queriesFixture = `.I 10
.W
what pressure distribution exists over a wing
.I 20
.W
how is heat transfer estimated in hypersonic flow
`;

test("parses Glasgow Cranfield documents into the OpenSearch schema", () => {
  const documents = parseCranfieldDocuments(docsFixture, { indexedAt: "2026-07-04T00:00:00.000Z" });

  assert.equal(documents.length, 2);
  assert.equal(documents[0].id, "1");
  assert.equal(documents[0].dataset, "cranfield");
  assert.equal(documents[0].title, "experimental investigation of the aerodynamics of a wing");
  assert.match(documents[0].abstract, /pressure distribution/);
  assert.match(documents[0].text, /Smith, J\./);
  assert.equal(documents[0].source, "glasgow-cranfield-1400");
});

test("parses Cranfield queries using ir_datasets-compatible query ids", () => {
  const queries = parseCranfieldQueries(queriesFixture);

  assert.deepEqual(queries, [
    { id: "1", query: "what pressure distribution exists over a wing" },
    { id: "2", query: "how is heat transfer estimated in hypersonic flow" }
  ]);
});

test("parses qrels and joins them to evaluation queries", () => {
  const queries = parseCranfieldQueries(queriesFixture);
  const qrels = parseCranfieldQrels("1 1 4\n1 2 -1\n2 2 3\n");
  const evaluationQueries = buildCranfieldQueriesWithQrels(queries, qrels);

  assert.deepEqual(qrels[0], { queryId: "1", documentId: "1", relevance: 4 });
  assert.deepEqual(evaluationQueries[0].qrels, { "1": 4, "2": -1 });
  assert.deepEqual(evaluationQueries[1].qrels, { "2": 3 });
});

test("builds an OpenSearch bulk payload for the full Cranfield export path", () => {
  const documents = parseCranfieldDocuments(docsFixture, { indexedAt: "2026-07-04T00:00:00.000Z" });
  const payload = buildCranfieldBulkPayload(documents, { index: "cranfield-v0" }).trim().split("\n");

  assert.equal(payload.length, 4);
  assert.deepEqual(JSON.parse(payload[0]), { index: { _index: "cranfield-v0", _id: "1" } });
  assert.equal(JSON.parse(payload[1]).id, "1");
});
