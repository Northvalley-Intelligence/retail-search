import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { localHashEmbedding, normalizeVector } from "../src/evaluation/vector-search.js";
import { mergedEnv } from "./lib/local-env.mjs";

const DEFAULT_DOCUMENTS = "/private/tmp/retail-search-cranfield-live/documents.jsonl";
const DEFAULT_QUERIES = "/private/tmp/retail-search-cranfield-live/queries.json";
const DEFAULT_OPENAI_MODEL = "text-embedding-3-small";
const DEFAULT_OLLAMA_MODEL = "llama3.1:8b";
const DEFAULT_OLLAMA_HOST = "http://127.0.0.1:11434";
const DEFAULT_HUGGINGFACE_MODEL = "BAAI/bge-base-en-v1.5";
const HUGGINGFACE_HELPER = new URL("./lib/huggingface-embed.py", import.meta.url);

function parseArgs(argv) {
  const args = {
    documents: DEFAULT_DOCUMENTS,
    queries: DEFAULT_QUERIES,
    write: null,
    provider: "local-hash",
    model: null,
    host: null,
    pythonBin: null,
    hfCacheDir: null,
    hfDevice: null,
    trustRemoteCode: false,
    dimensions: 384,
    batchSize: 64,
    encoderBatchSize: 32,
    checkpointDir: null,
    textProfile: "full",
    documentPrefix: "",
    queryPrefix: "",
    datasetLabel: "cranfield",
    progress: false,
    summary: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--documents") {
      args.documents = argv[index + 1];
      index += 1;
    } else if (value === "--queries") {
      args.queries = argv[index + 1];
      index += 1;
    } else if (value === "--write") {
      args.write = argv[index + 1];
      index += 1;
    } else if (value === "--provider") {
      args.provider = argv[index + 1];
      index += 1;
    } else if (value === "--model") {
      args.model = argv[index + 1];
      index += 1;
    } else if (value === "--host") {
      args.host = argv[index + 1];
      index += 1;
    } else if (value === "--python-bin") {
      args.pythonBin = argv[index + 1];
      index += 1;
    } else if (value === "--hf-cache-dir") {
      args.hfCacheDir = argv[index + 1];
      index += 1;
    } else if (value === "--hf-device") {
      args.hfDevice = argv[index + 1];
      index += 1;
    } else if (value === "--trust-remote-code") {
      args.trustRemoteCode = true;
    } else if (value === "--dimensions") {
      args.dimensions = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--batch-size") {
      args.batchSize = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--encoder-batch-size") {
      args.encoderBatchSize = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--checkpoint-dir") {
      args.checkpointDir = argv[index + 1];
      index += 1;
    } else if (value === "--text-profile") {
      args.textProfile = argv[index + 1];
      index += 1;
    } else if (value === "--document-prefix") {
      args.documentPrefix = argv[index + 1];
      index += 1;
    } else if (value === "--query-prefix") {
      args.queryPrefix = argv[index + 1];
      index += 1;
    } else if (value === "--dataset-label") {
      args.datasetLabel = argv[index + 1];
      index += 1;
    } else if (value === "--progress") {
      args.progress = true;
    } else if (value === "--summary") {
      args.summary = true;
    }
  }

  if (!args.write) {
    throw new Error("--write is required");
  }

  if (!["local-hash", "openai", "ollama", "huggingface"].includes(args.provider)) {
    throw new Error("--provider must be local-hash, openai, ollama, or huggingface");
  }
  if (!["full", "title-abstract"].includes(args.textProfile)) {
    throw new Error("--text-profile must be full or title-abstract");
  }

  return args;
}

function logProgress(args, message) {
  if (args.progress) {
    console.error(message);
  }
}

async function readJsonl(path) {
  const content = await readFile(path, "utf8");
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function readCheckpoint(path) {
  if (!path || !existsSync(path)) {
    return [];
  }
  return readJsonl(path);
}

async function appendCheckpoint(path, rows) {
  if (!path || rows.length === 0) {
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, rows.map((row) => JSON.stringify(row)).join("\n").concat("\n"));
}

function documentEmbeddingText(document, args) {
  const prefix = args.documentPrefix || "";
  if (args.textProfile === "title-abstract") {
    return `${prefix}${[document.title, document.abstract].filter(Boolean).join("\n")}`;
  }
  return `${prefix}${[document.title, document.abstract, document.text].filter(Boolean).join("\n")}`;
}

function queryEmbeddingText(query, args) {
  return `${args.queryPrefix || ""}${query.query}`;
}

async function embedLocalHash(rows, args) {
  return rows.map((row) => ({
    id: row.id,
    embedding: localHashEmbedding(row.text, { dimensions: args.dimensions })
  }));
}

async function embedOpenAIBatch(batch, args) {
  const env = mergedEnv();
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for --provider openai");
  }

  const model = args.model || env.OPENAI_EMBEDDING_MODEL || DEFAULT_OPENAI_MODEL;
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: batch.map((row) => row.text)
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI embeddings request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const data = [...payload.data].sort((a, b) => a.index - b.index);
  return data.map((item, offset) => ({
    id: batch[offset].id,
    embedding: normalizeVector(item.embedding)
  }));
}

async function embedOllamaBatch(batch, args) {
  const env = mergedEnv();
  const host = String(args.host || env.OLLAMA_HOST || DEFAULT_OLLAMA_HOST).replace(/\/+$/u, "");
  const model = args.model || env.OLLAMA_EMBEDDING_MODEL || env.MODEL_NAME || DEFAULT_OLLAMA_MODEL;
  const response = await fetch(`${host}/api/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: batch.map((row) => row.text)
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama embeddings request failed with status ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload.embeddings)) {
    throw new Error("Ollama embeddings response did not include embeddings");
  }

  return payload.embeddings.map((embedding, offset) => ({
    id: batch[offset].id,
    embedding: normalizeVector(embedding)
  }));
}

async function embedHuggingFaceBatch(batch, args) {
  const env = mergedEnv();
  const pythonBin = args.pythonBin || env.HF_EMBEDDING_PYTHON || "python3";
  const model = args.model || env.HF_EMBEDDING_MODEL || DEFAULT_HUGGINGFACE_MODEL;
  const helperArgs = [
    HUGGINGFACE_HELPER.pathname,
    "--model",
    model,
    "--batch-size",
    String(args.encoderBatchSize || 32)
  ];

  if (args.hfCacheDir || env.HF_HOME) {
    helperArgs.push("--cache-dir", args.hfCacheDir || env.HF_HOME);
  }
  if (args.hfDevice || env.HF_EMBEDDING_DEVICE) {
    helperArgs.push("--device", args.hfDevice || env.HF_EMBEDDING_DEVICE);
  }
  if (args.trustRemoteCode) {
    helperArgs.push("--trust-remote-code");
  }

  const child = spawn(pythonBin, helperArgs, {
    stdio: ["pipe", "pipe", "pipe"]
  });
  const stdout = [];
  const stderr = [];
  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  child.stdin.end(JSON.stringify({ rows: batch }));

  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  const stderrText = Buffer.concat(stderr).toString("utf8").trim();
  if (exitCode !== 0) {
    throw new Error(`Hugging Face embedding helper failed with status ${exitCode}${stderrText ? `: ${stderrText}` : ""}`);
  }

  const payload = JSON.parse(Buffer.concat(stdout).toString("utf8"));
  if (!Array.isArray(payload.embeddings)) {
    throw new Error("Hugging Face embedding helper did not return embeddings");
  }
  return payload.embeddings.map((row) => ({
    id: row.id,
    embedding: normalizeVector(row.embedding)
  }));
}

async function embedProviderBatch(batch, args) {
  if (args.provider === "openai") {
    return embedOpenAIBatch(batch, args);
  }
  if (args.provider === "ollama") {
    return embedOllamaBatch(batch, args);
  }
  if (args.provider === "huggingface") {
    return embedHuggingFaceBatch(batch, args);
  }
  return embedLocalHash(batch, args);
}

async function embedRows(rows, args, options = {}) {
  const checkpointPath = options.checkpointPath || null;
  const existingRows = await readCheckpoint(checkpointPath);
  const existingIds = new Set(existingRows.map((row) => row.id));
  const embeddings = [...existingRows];
  const pendingRows = rows.filter((row) => !existingIds.has(row.id));
  const batchSize = Math.max(1, Number(args.batchSize) || 1);

  logProgress(args, `${options.label || "rows"}: ${existingRows.length}/${rows.length} restored from checkpoint`);

  for (let index = 0; index < pendingRows.length; index += batchSize) {
    const batch = pendingRows.slice(index, index + batchSize);
    const batchEmbeddings = await embedProviderBatch(batch, args);
    embeddings.push(...batchEmbeddings);
    await appendCheckpoint(checkpointPath, batchEmbeddings);
    logProgress(args, `${options.label || "rows"}: ${embeddings.length}/${rows.length} embedded`);
  }

  const byId = new Map(embeddings.map((row) => [row.id, row]));
  return rows.map((row) => byId.get(row.id)).filter(Boolean);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const documents = await readJsonl(args.documents);
  const queries = JSON.parse(await readFile(args.queries, "utf8"));
  const documentRows = documents.map((document) => ({
    id: document.id,
    text: documentEmbeddingText(document, args)
  }));
  const queryRows = queries.map((query) => ({
    id: query.id,
    text: queryEmbeddingText(query, args)
  }));

  const documentCheckpoint = args.checkpointDir ? join(args.checkpointDir, "documents.jsonl") : null;
  const queryCheckpoint = args.checkpointDir ? join(args.checkpointDir, "queries.jsonl") : null;
  const documentEmbeddings = await embedRows(documentRows, args, {
    label: "documents",
    checkpointPath: documentCheckpoint
  });
  const queryEmbeddings = await embedRows(queryRows, args, {
    label: "queries",
    checkpointPath: queryCheckpoint
  });
  const dimension = documentEmbeddings[0]?.embedding.length || 0;
  const output = {
    generatedAt: new Date().toISOString(),
    dataset: args.datasetLabel,
    transport:
      args.provider === "openai"
        ? "llm-embedding-api"
        : args.provider === "ollama"
          ? "local-ollama-embedding-api"
          : args.provider === "huggingface"
            ? "local-huggingface-sentence-transformers"
            : "deterministic-local-embedding-control",
    provider: args.provider,
    model:
      args.provider === "openai"
        ? args.model || mergedEnv().OPENAI_EMBEDDING_MODEL || DEFAULT_OPENAI_MODEL
        : args.provider === "ollama"
          ? args.model || mergedEnv().OLLAMA_EMBEDDING_MODEL || mergedEnv().MODEL_NAME || DEFAULT_OLLAMA_MODEL
          : args.provider === "huggingface"
            ? args.model || mergedEnv().HF_EMBEDDING_MODEL || DEFAULT_HUGGINGFACE_MODEL
            : "local-hash",
    host:
      args.provider === "ollama"
        ? String(args.host || mergedEnv().OLLAMA_HOST || DEFAULT_OLLAMA_HOST).replace(/\/+$/u, "")
        : null,
    python:
      args.provider === "huggingface"
        ? args.pythonBin || mergedEnv().HF_EMBEDDING_PYTHON || "python3"
        : null,
    dimension,
    documentsSource: args.documents,
    queriesSource: args.queries,
    documentCount: documentEmbeddings.length,
    queryCount: queryEmbeddings.length,
    textProfile:
      args.textProfile === "title-abstract"
        ? "document title + abstract; query text"
        : "document title + abstract + text; query text",
    documentPrefix: args.documentPrefix || null,
    queryPrefix: args.queryPrefix || null,
    caveat:
      args.provider === "local-hash"
        ? "This is a deterministic local vector-control artifact, not an LLM embedding result."
        : null,
    documents: documentEmbeddings,
    queries: queryEmbeddings
  };

  await mkdir(dirname(args.write), { recursive: true });
  await writeFile(args.write, `${JSON.stringify(output, null, 2)}\n`);

  const summary = {
    generatedAt: output.generatedAt,
    dataset: output.dataset,
    provider: output.provider,
    model: output.model,
    dimension: output.dimension,
    documentCount: output.documentCount,
    queryCount: output.queryCount,
    wrote: args.write,
    caveat: output.caveat
  };
  console.log(JSON.stringify(args.summary ? summary : output, null, 2));
}

main().catch((error) => {
  console.log(
    JSON.stringify(
      {
        status: "blocked",
        reason: "cranfield_embedding_cache_failed",
        errorCode: error.cause?.code || error.code || null,
        message: error.message,
        valuesPrinted: false
      },
      null,
      2
    )
  );
  process.exit(1);
});
