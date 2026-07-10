import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCranfieldSearchBody, buildPrfExpandedSearchBody } from "../src/cranfield/search.js";
import { CRANFIELD_PAPER_BM25_INDEX_BODY, normalizeQuery } from "../src/cranfield/schema.js";

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

test("builds coverage-rerank from field-sum retrieval with top 50 depth", () => {
  const body = buildCranfieldSearchBody("transonic aileron buzz", { size: 5, architecture: "coverage-rerank" });

  assert.equal(body.size, 50);
  assert.equal(body.query.bool.must, undefined);
  assert.equal(body.query.bool.minimum_should_match, 1);
  assert.equal(body.query.bool.should.length, 3);
  assert.equal(body.query.bool.should[0].match.title.boost, 3);
  assert.equal(body.query.bool.should[1].match.abstract.boost, 2);
  assert.equal(body.query.bool.should[2].match.text.boost, 1);
});

test("builds prf-rerank from field-sum retrieval with top 50 depth", () => {
  const body = buildCranfieldSearchBody("hypersonic viscous interaction", { size: 10, architecture: "prf-rerank" });

  assert.equal(body.size, 50);
  assert.equal(body.query.bool.must, undefined);
  assert.equal(body.query.bool.minimum_should_match, 1);
  assert.equal(body.query.bool.should.length, 3);
  assert.equal(body.query.bool.should[0].match.title.query, "hypersonic viscous interaction");
  assert.equal(body.query.bool.should[0].match.title.boost, 3);
  assert.equal(body.query.bool.should[1].match.abstract.boost, 2);
  assert.equal(body.query.bool.should[2].match.text.boost, 1);
});

test("builds prf-expand-rerank initial and expanded retrieval bodies", () => {
  const initial = buildCranfieldSearchBody("hypersonic viscous interaction", { size: 10, architecture: "prf-expand-rerank" });
  const expanded = buildPrfExpandedSearchBody("hypersonic viscous interaction", ["boundary", "shock", "blunt"], { size: 20 });

  assert.equal(initial.size, 50);
  assert.equal(initial.query.bool.must, undefined);
  assert.equal(initial.query.bool.minimum_should_match, 1);
  assert.equal(initial.query.bool.should.length, 3);
  assert.equal(expanded.size, 80);
  assert.equal(expanded.query.bool.minimum_should_match, 1);
  assert.equal(expanded.query.bool.should.length, 6);
  assert.equal(expanded.query.bool.should[0].match.title.query, "hypersonic viscous interaction");
  assert.equal(expanded.query.bool.should[3].match.title.query, "boundary shock blunt");
  assert.equal(expanded.query.bool.should[3].match.title.boost, 1.4);
  assert.equal(expanded.query.bool.should[5].match.text.boost, 0.4);
});

test("rejects empty queries before a search request can be sent", () => {
  assert.throws(() => buildCranfieldSearchBody("   "), /q is required/);
});

test("defines a paper-compatible BM25 index profile", () => {
  assert.equal(CRANFIELD_PAPER_BM25_INDEX_BODY.settings.index.similarity.paper_bm25.type, "BM25");
  assert.equal(CRANFIELD_PAPER_BM25_INDEX_BODY.settings.index.similarity.paper_bm25.k1, 1.5);
  assert.equal(CRANFIELD_PAPER_BM25_INDEX_BODY.settings.index.similarity.paper_bm25.b, 0.75);
  assert.equal(CRANFIELD_PAPER_BM25_INDEX_BODY.mappings.properties.text.similarity, "paper_bm25");
});
