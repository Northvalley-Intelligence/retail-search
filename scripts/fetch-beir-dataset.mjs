import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { extractZipEntries } from "../src/datasets/zip.js";
import { getDataset } from "../src/datasets/registry.js";

function parseArgs(argv) {
  const args = { dataset: null, force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--dataset") {
      args.dataset = argv[index + 1];
      index += 1;
    } else if (value === "--force") {
      args.force = true;
    }
  }
  if (!args.dataset) {
    throw new Error("--dataset is required, e.g. --dataset beir/scifact");
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dataset = getDataset(args.dataset);
  if (dataset.family !== "beir") {
    throw new Error(`Dataset ${dataset.id} is not a BEIR download`);
  }

  const corpusPath = join(dataset.dataDir, "corpus.jsonl");
  if (existsSync(corpusPath) && !args.force) {
    console.log(JSON.stringify({ status: "ok", dataset: dataset.id, action: "already-fetched", dataDir: dataset.dataDir }, null, 2));
    return;
  }

  const response = await fetch(dataset.downloadUrl);
  if (!response.ok) {
    throw new Error(`BEIR download failed for ${dataset.id}: ${response.status}`);
  }
  const archive = Buffer.from(await response.arrayBuffer());
  const checksum = createHash("md5").update(archive).digest("hex");
  const entries = extractZipEntries(archive);

  let written = 0;
  for (const [name, data] of entries) {
    const relative = name.split("/").slice(1).join("/");
    if (!relative) {
      continue;
    }
    const target = join(dataset.dataDir, relative);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
    written += 1;
  }
  if (!existsSync(corpusPath)) {
    throw new Error(`BEIR archive for ${dataset.id} did not contain corpus.jsonl`);
  }

  console.log(
    JSON.stringify(
      {
        status: "ok",
        dataset: dataset.id,
        action: "fetched",
        archiveBytes: archive.length,
        checksum,
        filesWritten: written,
        dataDir: dataset.dataDir
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.log(
    JSON.stringify(
      {
        status: "blocked",
        reason: "beir_fetch_failed",
        message: error.message,
        valuesPrinted: false
      },
      null,
      2
    )
  );
  process.exit(1);
});
