// BEIR-format dataset support: corpus.jsonl / queries.jsonl / qrels/<split>.tsv.
// Format reference: https://github.com/beir-cellar/beir (public datasets).

export function parseBeirCorpus(content) {
  return String(content)
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const record = JSON.parse(line);
      return {
        id: String(record._id),
        title: String(record.title || ""),
        text: String(record.text || "")
      };
    });
}

export function parseBeirQueries(content) {
  return String(content)
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const record = JSON.parse(line);
      return {
        id: String(record._id),
        query: String(record.text || "")
      };
    });
}

export function parseBeirQrels(content) {
  const lines = String(content).split("\n").filter(Boolean);
  const qrelsByQuery = {};
  for (const line of lines) {
    const [queryId, corpusId, score] = line.split("\t").map((value) => value.trim());
    if (!queryId || queryId === "query-id") {
      continue;
    }
    const grade = Number(score);
    if (!Number.isFinite(grade)) {
      throw new Error(`Invalid qrels grade for query ${queryId}`);
    }
    qrelsByQuery[queryId] = qrelsByQuery[queryId] || {};
    qrelsByQuery[queryId][corpusId] = grade;
  }
  return qrelsByQuery;
}

export function buildBeirEvaluationQueries(queries, qrelsByQuery) {
  const queryById = new Map(queries.map((query) => [query.id, query]));
  return Object.keys(qrelsByQuery)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((queryId) => {
      const query = queryById.get(queryId);
      if (!query) {
        throw new Error(`Qrels reference unknown query ${queryId}`);
      }
      return {
        id: queryId,
        query: query.query,
        qrels: qrelsByQuery[queryId]
      };
    });
}

export function buildBeirIndexBody() {
  return {
    settings: {
      index: {
        number_of_shards: 1,
        number_of_replicas: 0
      },
      analysis: {
        analyzer: {
          beir_english: {
            type: "english"
          }
        }
      }
    },
    mappings: {
      dynamic: "strict",
      properties: {
        id: { type: "keyword" },
        dataset: { type: "keyword" },
        title: {
          type: "text",
          analyzer: "beir_english"
        },
        text: {
          type: "text",
          analyzer: "beir_english"
        }
      }
    }
  };
}

export function buildBeirBulkPayload(documents, { index, datasetId }) {
  return documents
    .flatMap((document) => [
      JSON.stringify({ index: { _index: index, _id: document.id } }),
      JSON.stringify({
        id: document.id,
        dataset: datasetId,
        title: document.title,
        text: document.text
      })
    ])
    .join("\n")
    .concat("\n");
}

// Matches the published BEIR lexical baseline: Elasticsearch-style BM25 with a
// best_fields multi_match over title and text, tie_breaker 0.5, default similarity.
export function buildBeirBm25SearchBody(query, size) {
  return {
    size,
    _source: false,
    query: {
      multi_match: {
        query: String(query),
        type: "best_fields",
        fields: ["title", "text"],
        tie_breaker: 0.5
      }
    }
  };
}

export function parseBeirSearchResponse(payload) {
  const hits = payload?.hits?.hits || [];
  return hits.map((hit) => ({
    id: String(hit._id),
    score: hit._score
  }));
}
