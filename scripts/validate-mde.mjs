import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../.mde", import.meta.url);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(path)));
    } else {
      files.push(path);
    }
  }
  return files;
}

function parseJsonFile(path, content) {
  try {
    JSON.parse(content);
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${error.message}`);
  }
}

function parseJsonlFile(path, content) {
  content
    .split("\n")
    .filter(Boolean)
    .forEach((line, index) => {
      try {
        JSON.parse(line);
      } catch (error) {
        throw new Error(`${path}:${index + 1} is not valid JSONL: ${error.message}`);
      }
    });
}

const files = await walk(root.pathname);
for (const file of files) {
  const content = await readFile(file, "utf8");
  if (file.endsWith(".json")) {
    parseJsonFile(file, content);
  } else if (file.endsWith(".jsonl")) {
    parseJsonlFile(file, content);
  }
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      checkedFiles: files.length
    },
    null,
    2
  )
);

