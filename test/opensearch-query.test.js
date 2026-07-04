import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCranfieldSearchBody } from "../src/cranfield/search.js";
import { normalizeQuery } from "../src/cranfield/schema.js";

test("normalizes query text without adding semantic expansion", () => {
  const normalized = normalizeQuery("  wing   pressure   distribution  ");

  assert.equal(normalized.normalized, "wing pressure distribution");
  assert.deepEqual(normalized.transformations, [
    "trimmed leading/trailing whitespace",
    "collapsed repeated internal whitespace"
  ]);
});

test("builds a Cranfield OpenSearch BM25 baseline query", () => {
  const body = buildCranfieldSearchBody("wing pressure distribution", { size: 5 });

  assert.equal(body.size, 5);
  assert.equal(body.track_total_hits, true);
  assert.deepEqual(body.query.bool.filter, [{ term: { dataset: "cranfield" } }]);
  assert.deepEqual(body.query.bool.must[0].multi_match.fields, ["title^3", "abstract^2", "text"]);
  assert.equal(body.query.bool.must[0].multi_match.query, "wing pressure distribution");
  assert.equal(body.query.bool.must[0].multi_match.operator, "or");
});

test("rejects empty queries before a search request can be sent", () => {
  assert.throws(() => buildCranfieldSearchBody("   "), /q is required/);
});

