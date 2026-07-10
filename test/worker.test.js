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

function mockOpenSearchFetchWithHits(hits, assertions = {}) {
  return async (url, init) => {
    const body = JSON.parse(init.body);
    assertions.url?.(url);
    assertions.body?.(body);

    return new Response(
      JSON.stringify({
        took: 7,
        hits: {
          total: { value: hits.length, relation: "eq" },
          hits
        }
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };
}

function mockOpenSearchFetchSequence(responses) {
  let callIndex = 0;
  return async (url, init) => {
    const response = responses[callIndex];
    callIndex += 1;
    if (!response) {
      throw new Error(`Unexpected OpenSearch call ${callIndex}`);
    }
    const body = JSON.parse(init.body);
    response.assertions?.url?.(url);
    response.assertions?.body?.(body, callIndex);

    return new Response(
      JSON.stringify({
        took: response.took ?? 7,
        hits: {
          total: { value: response.hits.length, relation: "eq" },
          hits: response.hits
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
  assert.equal(payload.searchArchitecture.id, "baseline");
  assert.equal(payload.resultCount, 1);
  assert.equal(payload.results[0].id, "cranfield-sample-001");
  assert.equal(payload.latency.openSearchTookMs, 7);
});

test("query-rescue architecture adds targeted ranking clauses when requested", async () => {
  const response = await worker.fetch(
    new Request("https://retail-search.example/api/cranfield/search?q=transonic%20aileron%20buzz&architecture=query-rescue"),
    testEnv(
      mockOpenSearchFetch({
        body: (body) => {
          assert.equal(body.query.bool.must[0].multi_match.query, "transonic aileron buzz");
          assert.equal(body.query.bool.should.length, 3);
          assert.equal(body.query.bool.should[0].multi_match.type, "phrase");
          assert.equal(body.query.bool.should[1].multi_match.type, "cross_fields");
          assert.equal(body.query.bool.should[2].multi_match.minimum_should_match, "70%");
        }
      })
    )
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.searchArchitecture.id, "query-rescue");
  assert.equal(payload.searchArchitecture.status, "candidate");
  assert.equal(payload.searchArchitecture.searchEvolutionId, "SE-0002");
});

test("field-sum architecture adds field-specific scoring clauses when requested", async () => {
  const response = await worker.fetch(
    new Request("https://retail-search.example/api/cranfield/search?q=boundary%20layer%20flows&architecture=field-sum"),
    testEnv(
      mockOpenSearchFetch({
        body: (body) => {
          assert.equal(body.query.bool.must, undefined);
          assert.equal(body.query.bool.minimum_should_match, 1);
          assert.equal(body.query.bool.should.length, 3);
          assert.equal(body.query.bool.should[0].match.title.boost, 3);
          assert.equal(body.query.bool.should[1].match.abstract.boost, 2);
          assert.equal(body.query.bool.should[2].match.text.boost, 1);
        }
      })
    )
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.searchArchitecture.id, "field-sum");
  assert.equal(payload.searchArchitecture.architectureVersion, "ARCH-0.2-candidate");
});

test("coverage-rerank architecture retrieves field-sum candidates and returns rerank metadata", async () => {
  const response = await worker.fetch(
    new Request("https://retail-search.example/api/cranfield/search?q=transonic%20aileron%20buzz&size=3&architecture=coverage-rerank"),
    testEnv(
      mockOpenSearchFetch({
        body: (body) => {
          assert.equal(body.size, 50);
          assert.equal(body.query.bool.must, undefined);
          assert.equal(body.query.bool.minimum_should_match, 1);
          assert.equal(body.query.bool.should.length, 3);
          assert.equal(body.query.bool.should[0].match.title.query, "transonic aileron buzz");
        }
      })
    )
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.searchArchitecture.id, "coverage-rerank");
  assert.equal(payload.searchArchitecture.status, "candidate");
  assert.equal(payload.reranking.strategy, "title_abstract_coverage");
  assert.equal(payload.reranking.retrieveSize, 50);
  assert.equal(payload.reranking.returnedSize, 3);
  assert.equal(payload.results[0].originalRank, 1);
  assert.equal(typeof payload.results[0].rerankScore, "number");
});

test("prf-rerank architecture returns feedback term metadata", async () => {
  const response = await worker.fetch(
    new Request("https://retail-search.example/api/cranfield/search?q=hypersonic%20viscous%20interaction&size=2&architecture=prf-rerank"),
    testEnv(
      mockOpenSearchFetchWithHits(
        [
          {
            _id: "a",
            _score: 11,
            _source: {
              id: "a",
              dataset: "cranfield",
              title: "Hypersonic viscous interaction near blunt bodies",
              abstract: "Boundary layer shock interaction and blunt body flow measurements.",
              text: "",
              source: "fixture"
            }
          },
          {
            _id: "b",
            _score: 10,
            _source: {
              id: "b",
              dataset: "cranfield",
              title: "Shock boundary layer measurements",
              abstract: "Viscous hypersonic flow interaction measurements over cones.",
              text: "",
              source: "fixture"
            }
          }
        ],
        {
          body: (body) => {
            assert.equal(body.size, 50);
            assert.equal(body.query.bool.must, undefined);
            assert.equal(body.query.bool.minimum_should_match, 1);
          }
        }
      )
    )
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.searchArchitecture.id, "prf-rerank");
  assert.equal(payload.reranking.strategy, "pseudo_relevance_feedback_title_abstract_coverage");
  assert.equal(payload.reranking.feedbackDocuments, 4);
  assert.equal(payload.reranking.feedbackTerms, 8);
  assert.equal(payload.reranking.phraseWeight, 0.01);
  assert.ok(payload.reranking.expansionTerms.includes("boundary"));
  assert.equal(payload.results.length, 2);
  assert.equal(typeof payload.results[0].rerankScore, "number");
});

test("prf-expand-rerank architecture runs expanded retrieval and returns merged metadata", async () => {
  const initialHits = [
    {
      _id: "a",
      _score: 11,
      _source: {
        id: "a",
        dataset: "cranfield",
        title: "Hypersonic viscous interaction near blunt bodies",
        abstract: "Boundary layer shock interaction and blunt body flow measurements.",
        text: "",
        source: "fixture"
      }
    },
    {
      _id: "b",
      _score: 10,
      _source: {
        id: "b",
        dataset: "cranfield",
        title: "Shock boundary layer measurements",
        abstract: "Viscous hypersonic flow interaction measurements over cones.",
        text: "",
        source: "fixture"
      }
    }
  ];
  const expandedHits = [
    initialHits[0],
    {
      _id: "c",
      _score: 9,
      _source: {
        id: "c",
        dataset: "cranfield",
        title: "Blunt body shock layer flow",
        abstract: "Boundary measurements in hypersonic viscous flow.",
        text: "",
        source: "fixture"
      }
    }
  ];

  const response = await worker.fetch(
    new Request("https://retail-search.example/api/cranfield/search?q=hypersonic%20viscous%20interaction&size=3&architecture=prf-expand-rerank"),
    testEnv(
      mockOpenSearchFetchSequence([
        {
          hits: initialHits,
          assertions: {
            body: (body) => {
              assert.equal(body.size, 50);
              assert.equal(body.query.bool.should.length, 3);
            }
          }
        },
        {
          hits: expandedHits,
          assertions: {
            body: (body) => {
              assert.equal(body.size, 80);
              assert.equal(body.query.bool.should.length, 6);
              assert.match(body.query.bool.should[3].match.title.query, /boundary/);
            }
          }
        }
      ])
    )
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.searchArchitecture.id, "prf-expand-rerank");
  assert.equal(payload.reranking.strategy, "pseudo_relevance_feedback_expanded_retrieval_rerank");
  assert.equal(payload.reranking.retrieveSize, 50);
  assert.equal(payload.reranking.expandedRetrieveSize, 80);
  assert.equal(payload.reranking.mergedCandidateCount, 3);
  assert.ok(payload.reranking.expansionTerms.includes("boundary"));
  assert.equal(payload.results.length, 3);
  assert.ok(payload.results.some((result) => result.id === "c" && result.retrievalSources.includes("expanded")));
  assert.equal(typeof payload.results[0].rerankScore, "number");
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
  assert.match(html, /Architecture milestones/);
  assert.match(html, /ARCH-0.3 demo samples/);
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

test("milestone baseline endpoint is a stable alias that ignores architecture overrides", async () => {
  const response = await worker.fetch(
    new Request("https://retail-search.example/api/milestones/arch-0.1/search?q=wing%20pressure&architecture=prf-rerank"),
    testEnv(
      mockOpenSearchFetch({
        body: (body) => {
          assert.equal(body.size, 10);
          assert.equal(body.query.bool.must[0].multi_match.query, "wing pressure");
        }
      })
    )
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.milestone.id, "arch-0.1");
  assert.equal(payload.milestone.architectureVersion, "ARCH-0.1");
  assert.equal(payload.searchArchitecture.id, "baseline");
});

test("milestone PRF explain endpoint exposes the refined PRF candidate path", async () => {
  const response = await worker.fetch(
    new Request("https://retail-search.example/api/milestones/arch-0.2-prf/explain?q=hypersonic%20viscous%20interaction&size=2"),
    testEnv(
      mockOpenSearchFetchWithHits(
        [
          {
            _id: "a",
            _score: 11,
            _source: {
              id: "a",
              dataset: "cranfield",
              title: "Hypersonic viscous interaction near blunt bodies",
              abstract: "Boundary layer shock interaction and blunt body flow measurements.",
              text: "",
              source: "fixture"
            }
          },
          {
            _id: "b",
            _score: 10,
            _source: {
              id: "b",
              dataset: "cranfield",
              title: "Shock boundary layer measurements",
              abstract: "Viscous hypersonic flow interaction measurements over cones.",
              text: "",
              source: "fixture"
            }
          }
        ],
        {
          body: (body) => {
            assert.equal(body.size, 50);
            assert.equal(body.query.bool.minimum_should_match, 1);
          }
        }
      )
    )
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.milestone.id, "arch-0.2-prf");
  assert.equal(payload.milestone.architectureVersion, "ARCH-0.2-candidate");
  assert.equal(payload.searchArchitecture.id, "prf-rerank");
  assert.equal(payload.reranking.strategy, "pseudo_relevance_feedback_title_abstract_coverage");
  assert.equal(payload.openSearch.query.size, 50);
  assert.ok(payload.topResults[0].explanation.includes("pseudo-relevance-feedback"));
});

test("milestone BGE endpoints return an explicit candidate runtime limitation", async () => {
  const failIfCalled = async () => {
    throw new Error("OpenSearch should not be called for the disabled BGE runtime milestone");
  };

  for (const path of ["/api/milestones/arch-0.3-bge/search", "/api/milestones/arch-0.3-bge/explain"]) {
    const response = await worker.fetch(new Request(`https://retail-search.example${path}?q=wing%20pressure`), testEnv(failIfCalled));
    assert.equal(response.status, 501);
    const payload = await response.json();
    assert.equal(payload.error.code, "milestone_runtime_not_enabled");
    assert.equal(payload.milestone.id, "arch-0.3-bge");
    assert.equal(payload.milestone.architectureVersion, "ARCH-0.3-candidate");
    assert.equal(payload.milestone.remoteIndex, "cranfield-v0-bge-base-en-v15-gen023");
    assert.equal(payload.traceability.architectureVersion, "ARCH-0.1");
  }
});

test("milestone BGE demo endpoint returns archived sample rows without runtime search", async () => {
  const response = await worker.fetch(
    new Request("https://retail-search.example/api/milestones/arch-0.3-bge/demo?sample=all"),
    testEnv(async () => {
      throw new Error("OpenSearch should not be called for archived ARCH-0.3 demo samples");
    })
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.demoMode, "archived_evaluation_samples");
  assert.equal(payload.archivedValidation.generationId, "GEN-023");
  assert.equal(payload.samples.length, 3);
  assert.equal(payload.samples[0].queryId, "1");
  assert.equal(payload.samples[2].queryId, "9");
  assert.match(payload.samples[1].note, /archived remote OpenSearch BGE hybrid sample/i);
});

test("milestone BGE demo endpoint can return a single archived sample", async () => {
  const response = await worker.fetch(
    new Request("https://retail-search.example/api/milestones/arch-0.3-bge/demo?sample=3"),
    testEnv(async () => {
      throw new Error("OpenSearch should not be called for archived ARCH-0.3 demo samples");
    })
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.samples.length, 1);
  assert.equal(payload.samples[0].queryId, "3");
  assert.equal(payload.samples[0].metrics.ndcgAtK, 0.9021);
});

test("unknown milestone endpoint returns an explicit not found error", async () => {
  const response = await worker.fetch(
    new Request("https://retail-search.example/api/milestones/arch-9/search?q=wing"),
    testEnv(mockOpenSearchFetch())
  );

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, "unknown_milestone");
});

test("empty query and missing OpenSearch configuration return explicit errors", async () => {
  const missingQuery = await worker.fetch(new Request("https://retail-search.example/api/cranfield/search?q=   "), testEnv(mockOpenSearchFetch()));
  assert.equal(missingQuery.status, 400);
  assert.equal((await missingQuery.json()).error.code, "missing_query");

  const missingConfig = await worker.fetch(new Request("https://retail-search.example/api/cranfield/search?q=wing"), {});
  assert.equal(missingConfig.status, 503);
  assert.equal((await missingConfig.json()).error.code, "search_configuration_error");
});
