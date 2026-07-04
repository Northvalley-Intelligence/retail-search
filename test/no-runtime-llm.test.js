import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const bannedPatterns = [
  /\bopenai\b/i,
  /\banthropic\b/i,
  /\bchat.completions\b/i,
  /\bresponses\.create\b/i,
  /\bgenerateContent\b/i
];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(path)));
    } else if (path.endsWith(".js")) {
      files.push(path);
    }
  }
  return files;
}

test("live search source does not include runtime LLM dependencies", async () => {
  const files = await walk(new URL("../src", import.meta.url).pathname);
  for (const file of files) {
    const content = await readFile(file, "utf8");
    for (const pattern of bannedPatterns) {
      assert.equal(pattern.test(content), false, `${file} matched ${pattern}`);
    }
  }
});

