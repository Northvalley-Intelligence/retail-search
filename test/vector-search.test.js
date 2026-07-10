import assert from "node:assert/strict";
import { test } from "node:test";
import {
  blendRankings,
  dotProduct,
  localHashEmbedding,
  rankByVector,
  reciprocalRankFusion
} from "../src/evaluation/vector-search.js";

test("local hash embeddings are deterministic and normalized", () => {
  const first = localHashEmbedding("wing pressure distribution", { dimensions: 32 });
  const second = localHashEmbedding("wing pressure distribution", { dimensions: 32 });
  assert.deepEqual(first, second);
  const magnitude = Math.sqrt(first.reduce((sum, value) => sum + value * value, 0));
  assert.ok(Math.abs(magnitude - 1) < 0.00001);
});

test("vector ranking orders documents by dot product", () => {
  const query = [1, 0];
  const ranked = rankByVector(
    query,
    [
      { id: "b", embedding: [0.1, 0.9] },
      { id: "a", embedding: [0.9, 0.1] }
    ],
    { size: 2 }
  );
  assert.equal(dotProduct(query, ranked[0].id === "a" ? [0.9, 0.1] : [0.1, 0.9]), 0.9);
  assert.deepEqual(
    ranked.map((result) => result.id),
    ["a", "b"]
  );
});

test("hybrid blending and RRF combine lexical and vector evidence", () => {
  const lexical = [
    { id: "lexical", score: 10 },
    { id: "shared", score: 5 }
  ];
  const vector = [
    { id: "vector", score: 1 },
    { id: "shared", score: 0.8 }
  ];

  const blended = blendRankings(lexical, vector, { leftWeight: 0.5, rightWeight: 0.5, size: 3 });
  assert.equal(blended.length, 3);
  assert.ok(blended.some((result) => result.id === "shared"));

  const fused = reciprocalRankFusion(
    [
      { weight: 0.5, results: lexical },
      { weight: 0.5, results: vector }
    ],
    { size: 3 }
  );
  assert.equal(fused.length, 3);
  assert.equal(fused[0].id, "shared");
});
