import assert from "node:assert/strict";
import { test } from "node:test";
import {
  COVERAGE_RERANK_WEIGHT,
  PRF_EXPANSION_WEIGHT,
  coverageScoreForTokens,
  feedbackTerms,
  rerankByCoverage,
  rerankByPseudoRelevanceFeedback,
  significantTokens
} from "../src/evaluation/rerankers.js";

// Guards the Mission Update 002 requirement that Phase 1 techniques run unchanged:
// hyperparameters stay frozen at their Cranfield-tuned values, so a regression in
// these constants (which would silently change every cross-domain data point) fails here.
test("Phase 1 rerank hyperparameters remain frozen at Cranfield-tuned values", () => {
  assert.equal(COVERAGE_RERANK_WEIGHT, 0.08);
  assert.equal(PRF_EXPANSION_WEIGHT, 0.14);
});

test("tokenizer drops short tokens and stopwords", () => {
  const tokens = significantTokens("What is the aerodynamic heating of a wing");
  assert.ok(tokens.includes("aerodynamic"));
  assert.ok(tokens.includes("heating"));
  assert.ok(tokens.includes("wing"));
  assert.ok(!tokens.includes("the"));
  assert.ok(!tokens.includes("is"));
});

test("coverage rerank favors documents whose fields contain query terms", () => {
  const query = "aerodynamic heating";
  const results = [
    { id: "a", score: 10, title: "unrelated title", text: "nothing relevant here" },
    { id: "b", score: 9, title: "aerodynamic heating study", text: "aerodynamic heating of surfaces" }
  ];
  const reranked = rerankByCoverage(query, results, { bodyField: "text" });
  assert.equal(reranked[0].id, "b");
  assert.equal(reranked[0].originalRank, 2);
});

test("coverage rerank preserves original order on a tie via originalRank", () => {
  const query = "nomatch";
  const results = [
    { id: "first", score: 5, title: "x", text: "y" },
    { id: "second", score: 5, title: "x", text: "y" }
  ];
  const reranked = rerankByCoverage(query, results, { bodyField: "text" });
  assert.deepEqual(reranked.map((r) => r.id), ["first", "second"]);
});

test("PRF feedback terms are drawn from top documents and exclude query terms", () => {
  const original = significantTokens("thermal expansion");
  const results = [
    { id: "1", score: 9, title: "thermal expansion coefficient", text: "measuring the coefficient of thermal expansion in alloys" },
    { id: "2", score: 8, title: "alloy properties", text: "alloys exhibit predictable coefficient behavior" }
  ];
  const terms = feedbackTerms(results, original, { bodyField: "text" });
  assert.ok(terms.includes("coefficient"));
  assert.ok(!terms.includes("thermal"));
  assert.ok(!terms.includes("expansion"));
});

test("PRF rerank returns expansion terms and a fully ordered result set", () => {
  const query = "thermal expansion";
  const results = [
    { id: "a", score: 10, title: "irrelevant", text: "no shared vocabulary at all" },
    { id: "b", score: 9, title: "thermal expansion coefficient", text: "coefficient of thermal expansion measured in alloys" }
  ];
  const { results: reranked, expansionTerms } = rerankByPseudoRelevanceFeedback(query, results, { bodyField: "text" });
  assert.equal(reranked.length, 2);
  assert.ok(Array.isArray(expansionTerms));
  assert.equal(reranked[0].id, "b");
});

test("coverage score uses configurable body field for BEIR (text) vs Cranfield (abstract)", () => {
  const tokens = significantTokens("aerodynamic heating");
  const doc = { title: "", abstract: "aerodynamic heating in the abstract", text: "aerodynamic heating in the text" };
  const viaText = coverageScoreForTokens(tokens, doc, { bodyField: "text" });
  const viaAbstract = coverageScoreForTokens(tokens, doc, { bodyField: "abstract" });
  assert.ok(viaText > 0);
  assert.ok(viaAbstract > 0);
  // A document lacking the chosen body field scores zero on the body component.
  const noText = coverageScoreForTokens(tokens, { title: "", text: "" }, { bodyField: "text" });
  assert.equal(noText, 0);
});
