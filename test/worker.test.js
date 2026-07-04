import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../src/worker.js";

function mockOpenSearchFetch(assertions = {}) {
  return async (url, init) => {
    const body = JSON.parse(init.body);
    assertions.url?.(url);
    assertions.body?.(body);

    return new Response(
      JSON.stringify({
        took: 7,
        hits: {
          total: { value: 1, relation: "eq" },
          hits: [
            {
              _id: "cranfield-sample-001",
              _score: 12.5,
              _source: {
                id: "cranfield-sample-001",
                dataset: "cranfield",
                title: "Pressure distribution over a swept wing",
                abstract: "Measurements describe wing pressure distribution.",
                text: "A wind tunnel study records pressure distribution.",
                source: "sample-cranfield-fixture"
              }
            }
          ]
        }
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };
}

function testEnv(fetchImpl) {
  return {
    OPENSEARCH_URL: "https://opensearch.example.test",
    OPENSEARCH_USERNAME: "user",
    OPENSEARCH_PASSWORD: "pass",
    CRANFIELD_INDEX: "cranfield-v0",
    ARCHITECTURE_VERSION: "v0-cranfield-opensearch-baseline",
    OPENSEARCH_FETCH: fetchImpl
  };
}

test("search endpoint calls the configured OpenSearch index and returns mapped hits", async () => {
  const response = await worker.fetch(
    new Request("https://retail-search.example/api/cranfield/search?q=wing%20pressure&size=3"),
    testEnv(
      mockOpenSearchFetch({
        url: (url) => assert.equal(url, "https://opensearch.example.test/cranfield-v0/_search"),
        body: (body) => {
          assert.equal(body.size, 3);
          assert.equal(body.query.bool.must[0].multi_match.query, "wing pressure");
        }
      })
    )
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.dataset, "cranfield");
  assert.equal(payload.resultCount, 1);
  assert.equal(payload.results[0].id, "cranfield-sample-001");
  assert.equal(payload.latency.openSearchTookMs, 7);
});

test("explain endpoint returns generated OpenSearch query and ranking metadata", async () => {
  const response = await worker.fetch(
    new Request("https://retail-search.example/api/cranfield/explain?q=wing%20pressure"),
    testEnv(mockOpenSearchFetch())
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.dataset, "cranfield");
  assert.equal(payload.openSearch.index, "cranfield-v0");
  assert.equal(payload.openSearch.query.query.bool.must[0].multi_match.query, "wing pressure");
  assert.ok(payload.rankingLogic.some((item) => item.includes("OpenSearch BM25 baseline")));
  assert.equal(payload.acceptedArchitectureDecisions[0].id, "ADL-001");
  assert.equal(payload.topResults[0].rank, 1);
});

test("latest and versioned endpoint aliases route to the Cranfield baseline", async () => {
  for (const path of ["/api/search", "/api/v0/search"]) {
    const response = await worker.fetch(
      new Request(`https://retail-search.example${path}?q=boundary%20layer`),
      testEnv(mockOpenSearchFetch())
    );
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.architectureVersion, "v0-cranfield-opensearch-baseline");
  }
});

test("empty query and missing OpenSearch configuration return explicit errors", async () => {
  const missingQuery = await worker.fetch(new Request("https://retail-search.example/api/cranfield/search?q=   "), testEnv(mockOpenSearchFetch()));
  assert.equal(missingQuery.status, 400);
  assert.equal((await missingQuery.json()).error.code, "missing_query");

  const missingConfig = await worker.fetch(new Request("https://retail-search.example/api/cranfield/search?q=wing"), {});
  assert.equal(missingConfig.status, 503);
  assert.equal((await missingConfig.json()).error.code, "search_configuration_error");
});

