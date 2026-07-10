const DEFAULT_DIMENSIONS = 384;

export function tokenizeForEmbedding(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length > 1);
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function normalizeVector(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) {
    return vector.map(() => 0);
  }
  return vector.map((value) => Math.round((value / magnitude) * 1000000) / 1000000);
}

function addFeature(vector, feature, weight) {
  const hash = hashString(feature);
  const index = hash % vector.length;
  const sign = hash & 1 ? 1 : -1;
  vector[index] += sign * weight;
}

export function localHashEmbedding(value, options = {}) {
  const dimensions = Number(options.dimensions || DEFAULT_DIMENSIONS);
  const vector = Array.from({ length: dimensions }, () => 0);
  const tokens = tokenizeForEmbedding(value);

  for (const token of tokens) {
    addFeature(vector, `tok:${token}`, 1);
  }

  for (let index = 0; index < tokens.length - 1; index += 1) {
    addFeature(vector, `bi:${tokens[index]}:${tokens[index + 1]}`, 0.5);
  }

  return normalizeVector(vector);
}

export function dotProduct(left, right) {
  const length = Math.min(left.length, right.length);
  let score = 0;
  for (let index = 0; index < length; index += 1) {
    score += left[index] * right[index];
  }
  return score;
}

export function rankByVector(queryVector, documentEmbeddings, options = {}) {
  const size = Number(options.size || documentEmbeddings.length);
  return documentEmbeddings
    .map((document) => ({
      id: document.id,
      score: dotProduct(queryVector, document.embedding)
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, size);
}

export function minMaxScores(results) {
  if (!results.length) {
    return new Map();
  }
  const scores = results.map((result) => Number(result.score || 0));
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  return new Map(results.map((result) => [result.id, (Number(result.score || 0) - min) / range]));
}

export function blendRankings(leftResults, rightResults, options = {}) {
  const leftWeight = Number(options.leftWeight ?? 0.5);
  const rightWeight = Number(options.rightWeight ?? 0.5);
  const size = Number(options.size || Math.max(leftResults.length, rightResults.length));
  const leftScores = minMaxScores(leftResults);
  const rightScores = minMaxScores(rightResults);
  const ids = new Set([...leftScores.keys(), ...rightScores.keys()]);

  return Array.from(ids)
    .map((id) => ({
      id,
      score: leftWeight * (leftScores.get(id) || 0) + rightWeight * (rightScores.get(id) || 0)
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, size);
}

export function reciprocalRankFusion(resultSets, options = {}) {
  const k = Number(options.k || 60);
  const size = Number(options.size || Math.max(...resultSets.map((set) => set.results.length), 0));
  const scores = new Map();

  for (const set of resultSets) {
    const weight = Number(set.weight ?? 1);
    set.results.forEach((result, index) => {
      scores.set(result.id, (scores.get(result.id) || 0) + weight / (k + index + 1));
    });
  }

  return Array.from(scores.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, size);
}
