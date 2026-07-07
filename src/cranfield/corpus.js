import { basename } from "node:path";
import { gunzipSync } from "node:zlib";
import { DATASET_ID, DEFAULT_INDEX } from "./schema.js";

export const CRANFIELD_SOURCE = {
  datasetId: "cranfield",
  irDatasetsId: "cranfield",
  url: "http://ir.dcs.gla.ac.uk/resources/test_collections/cran/cran.tar.gz",
  expectedMd5: "1730f7be572d95a5a4b56c59a7b900a5",
  expectedDecodedTarMd5: "097d52aab6ea282ef3a21f5bc0036099",
  files: {
    documents: "cran.all.1400",
    queries: "cran.qry",
    qrels: "cranqrel"
  },
  expectedCounts: {
    documents: 1400,
    queries: 225,
    qrels: 1837
  }
};

const FIELD_MARKERS = {
  ".T": "title",
  ".A": "author",
  ".B": "bib",
  ".W": "text"
};

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseOctal(buffer) {
  const value = buffer.toString("utf8").replace(/\0.*$/u, "").trim();
  return value ? Number.parseInt(value, 8) : 0;
}

export function extractTarGzEntries(archiveBuffer) {
  const sourceBuffer = Buffer.from(archiveBuffer);
  const tarBuffer = sourceBuffer[0] === 0x1f && sourceBuffer[1] === 0x8b ? gunzipSync(sourceBuffer) : sourceBuffer;
  const entries = new Map();

  for (let offset = 0; offset < tarBuffer.length;) {
    const header = tarBuffer.subarray(offset, offset + 512);
    if (header.length < 512 || header.every((byte) => byte === 0)) {
      break;
    }

    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/u, "");
    const size = parseOctal(header.subarray(124, 136));
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;

    if (name && size > 0) {
      entries.set(basename(name), tarBuffer.subarray(dataStart, dataEnd).toString("utf8"));
    }

    offset = dataStart + Math.ceil(size / 512) * 512;
  }

  return entries;
}

function parseTaggedRecords(content, markerMap) {
  const records = [];
  let current = null;
  let activeField = null;

  for (const rawLine of String(content || "").split(/\r?\n/u)) {
    const idMatch = rawLine.match(/^\.I\s+(.+)$/u);
    if (idMatch) {
      if (current) {
        records.push(current);
      }
      current = { id: idMatch[1].trim() };
      activeField = null;
      continue;
    }

    if (!current) {
      continue;
    }

    const marker = rawLine.match(/^\.[A-Z]\b/u)?.[0];
    if (marker && markerMap[marker]) {
      activeField = markerMap[marker];
      current[activeField] ||= "";
      continue;
    }

    if (activeField) {
      current[activeField] = `${current[activeField] || ""}${rawLine}\n`;
    }
  }

  if (current) {
    records.push(current);
  }

  return records;
}

export function parseCranfieldDocuments(content, options = {}) {
  const indexedAt = options.indexedAt || new Date().toISOString();
  return parseTaggedRecords(content, FIELD_MARKERS).map((record) => {
    const title = cleanText(record.title) || `Cranfield document ${record.id}`;
    const abstract = cleanText(record.text);
    return {
      id: record.id,
      dataset: DATASET_ID,
      title,
      abstract,
      text: cleanText([title, record.author, record.bib, record.text].filter(Boolean).join("\n")),
      source: "glasgow-cranfield-1400",
      indexed_at: indexedAt
    };
  });
}

export function parseCranfieldQueries(content) {
  return parseTaggedRecords(content, { ".W": "text" }).map((record, index) => ({
    id: String(index + 1),
    query: cleanText(record.text)
  }));
}

export function parseCranfieldQrels(content) {
  return String(content || "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [queryId, documentId, relevance] = line.split(/\s+/u);
      if (!queryId || !documentId || relevance == null) {
        throw new Error(`Invalid Cranfield qrel line: ${line}`);
      }
      return {
        queryId,
        documentId,
        relevance: Number.parseInt(relevance, 10)
      };
    });
}

export function buildCranfieldQueriesWithQrels(queries, qrels) {
  const grouped = new Map();
  for (const qrel of qrels) {
    if (!grouped.has(qrel.queryId)) {
      grouped.set(qrel.queryId, {});
    }
    grouped.get(qrel.queryId)[qrel.documentId] = qrel.relevance;
  }

  return queries.map((query) => ({
    id: query.id,
    query: query.query,
    qrels: grouped.get(query.id) || {}
  }));
}

export function buildCranfieldBulkPayload(documents, options = {}) {
  const index = options.index || DEFAULT_INDEX;
  return documents
    .flatMap((document) => [
      JSON.stringify({ index: { _index: index, _id: document.id } }),
      JSON.stringify(document)
    ])
    .join("\n")
    .concat("\n");
}

export function parseCranfieldArchive(archiveBuffer, options = {}) {
  const entries = extractTarGzEntries(archiveBuffer);
  const documentsContent = entries.get(CRANFIELD_SOURCE.files.documents);
  const queriesContent = entries.get(CRANFIELD_SOURCE.files.queries);
  const qrelsContent = entries.get(CRANFIELD_SOURCE.files.qrels);

  if (!documentsContent || !queriesContent || !qrelsContent) {
    throw new Error("Cranfield archive is missing documents, queries, or qrels");
  }

  const documents = parseCranfieldDocuments(documentsContent, options);
  const queries = parseCranfieldQueries(queriesContent);
  const qrels = parseCranfieldQrels(qrelsContent);
  const evaluationQueries = buildCranfieldQueriesWithQrels(queries, qrels);

  return {
    source: CRANFIELD_SOURCE,
    documents,
    queries,
    qrels,
    evaluationQueries,
    counts: {
      documents: documents.length,
      queries: queries.length,
      qrels: qrels.length
    }
  };
}
