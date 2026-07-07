import { existsSync, readFileSync } from "node:fs";

function unquote(value) {
  const trimmed = String(value || "").trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function readLocalEnv(path = ".env.local") {
  if (!existsSync(path)) {
    return {};
  }

  const env = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);
    if (match) {
      env[match[1]] = unquote(match[2]);
    }
  }
  return env;
}

export function mergedEnv(path = ".env.local") {
  return {
    ...readLocalEnv(path),
    ...process.env
  };
}
