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
  assert.equal(payload.traceability.missionId, "M-0001");
  assert.equal(payload.traceability.searchEvolutionId, "SE-0001");
  assert.equal(payload.traceability.architectureVersion, "ARCH-0.1");
  assert.equal(payload.traceability.gitVersion, "working-tree");
  assert.equal(payload.resultCount, 1);
  assert.equal(payload.results[0].id, "cranfield-sample-001");
  assert.equal(payload.latency.openSearchTookMs, 7);
});

test("root endpoint serves the project phase overview", async () => {
  const response = await worker.fetch(new Request("https://retail-search.example/"), testEnv(mockOpenSearchFetch()));

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  const html = await response.text();
  assert.match(html, /Project phases/);
  assert.match(html, /Cranfield Foundation/);
  assert.match(html, /BEIR Transferability/);
  assert.match(html, /Retail Relevance/);
  assert.match(html, /Try Phase 1 Search/);
  assert.match(html, /Dataset references/);
  assert.match(html, /Glasgow Cranfield test collection/);
  assert.match(html, /BEIR project/);
  assert.match(html, /Amazon Science esci-data/);
  assert.doesNotMatch(html, /Strong baseline case/);
});

test("phase search page is focused on search without evaluation examples", async () => {
  const response = await worker.fetch(new Request("https://retail-search.example/phases/cranfield/search"), testEnv(mockOpenSearchFetch()));

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Search Cranfield/);
  assert.match(html, /1,400 indexed Cranfield documents/);
  assert.match(html, /wing pressure distribution/);
  assert.doesNotMatch(html, /Evaluation Results/);
  assert.doesNotMatch(html, /Failure case/);
  assert.doesNotMatch(html, /Wrong\/weak/);
});

test("phase data and planned phase pages include dataset references", async () => {
  const dataResponse = await worker.fetch(new Request("https://retail-search.example/phases/cranfield/data"), testEnv(mockOpenSearchFetch()));
  assert.equal(dataResponse.status, 200);
  const dataHtml = await dataResponse.text();
  assert.match(dataHtml, /Source reference/);
  assert.match(dataHtml, /Glasgow Cranfield test collection/);
  assert.match(dataHtml, /https:\/\/ir\.dcs\.gla\.ac\.uk\/resources\/test_collections\/cran\//);

  const beirResponse = await worker.fetch(new Request("https://retail-search.example/phases/beir"), testEnv(mockOpenSearchFetch()));
  assert.equal(beirResponse.status, 200);
  const beirHtml = await beirResponse.text();
  assert.match(beirHtml, /Dataset reference/);
  assert.match(beirHtml, /BEIR project/);
  assert.match(beirHtml, /https:\/\/github\.com\/beir-cellar\/beir/);
});

test("phase explain page is focused on the explain flow", async () => {
  const response = await worker.fetch(new Request("https://retail-search.example/phases/cranfield/explain"), testEnv(mockOpenSearchFetch()));

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Search explain flow/);
  assert.match(html, /OpenSearch Query/);
  assert.match(html, /Run explain/);
  assert.doesNotMatch(html, /Evaluation Results/);
  assert.doesNotMatch(html, /Wrong\/weak/);
});

test("phase evaluation page exposes metrics and examples without search results", async () => {
  const response = await worker.fetch(new Request("https://retail-search.example/phases/cranfield/evaluation"), testEnv(mockOpenSearchFetch()));

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Evaluation/);
  assert.match(html, /Strong baseline case/);
  assert.match(html, /Failure case/);
  assert.doesNotMatch(html, /Search Cranfield/);
});

test("dataset metadata endpoint describes indexed Cranfield data", async () => {
  const response = await worker.fetch(new Request("https://retail-search.example/api/cranfield/meta"), testEnv(mockOpenSearchFetch()));

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.id, "cranfield");
  assert.equal(payload.documentCount, 1400);
  assert.equal(payload.evaluationQueryCount, 225);
  assert.equal(payload.relevanceJudgmentCount, 1837);
  assert.equal(payload.source.url, "https://ir.dcs.gla.ac.uk/resources/test_collections/cran/");
  assert.equal(payload.traceability.searchEvolutionId, "SE-0001");
  assert.ok(payload.exampleQueries.includes("wing pressure distribution"));
  assert.ok(payload.indexedFields.some((field) => field.name === "title" && field.searchWeight === "3x"));
});

test("evaluation endpoint exposes aggregate metrics and judgment examples", async () => {
  const response = await worker.fetch(new Request("https://retail-search.example/api/cranfield/evaluation"), testEnv(mockOpenSearchFetch()));

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.dataset, "cranfield");
  assert.equal(payload.queryCount, 225);
  assert.equal(payload.traceability.architectureVersion, "ARCH-0.1");
  assert.equal(payload.metrics.map, 0.2402);
  assert.ok(payload.examples.some((example) => example.type === "weak" && example.wrongOrWeakResults.length > 0));
  assert.ok(payload.examples.some((example) => example.correctResults.length > 0));
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
  assert.equal(payload.retrievalFlow[0].id, "query");
  assert.ok(payload.retrievalFlow.some((step) => step.id === "rank" && step.title === "Rank"));
  assert.ok(payload.rankingLogic.some((item) => item.includes("OpenSearch BM25 baseline")));
  assert.equal(payload.traceability.architectureDecisionIds[0], "ADL-0001");
  assert.equal(payload.acceptedArchitectureDecisions[0].id, "ADL-0001");
  assert.deepEqual(payload.acceptedArchitectureDecisions[0].legacyIds, ["ADL-001"]);
  assert.equal(payload.topResults[0].rank, 1);
});

test("latest and versioned endpoint aliases route to the Cranfield baseline", async () => {
  for (const path of ["/api/search", "/api/v0/search", "/api/v0.1/search"]) {
    const response = await worker.fetch(
      new Request(`https://retail-search.example${path}?q=boundary%20layer`),
      testEnv(mockOpenSearchFetch())
    );
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.architectureVersion, "v0-cranfield-opensearch-baseline");
    assert.equal(payload.traceability.endpointVersion, "v0.1");
    assert.equal(payload.traceability.architectureVersion, "ARCH-0.1");
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
