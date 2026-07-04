import { createServer } from "node:http";
import worker from "../src/worker.js";

const port = Number(process.env.PORT || 8787);

function envFromProcess() {
  return {
    OPENSEARCH_URL: process.env.OPENSEARCH_URL,
    OPENSEARCH_API_KEY: process.env.OPENSEARCH_API_KEY,
    OPENSEARCH_USERNAME: process.env.OPENSEARCH_USERNAME,
    OPENSEARCH_PASSWORD: process.env.OPENSEARCH_PASSWORD,
    CRANFIELD_INDEX: process.env.CRANFIELD_INDEX || "cranfield-v0",
    ARCHITECTURE_VERSION: process.env.ARCHITECTURE_VERSION || "v0-cranfield-opensearch-baseline"
  };
}

createServer(async (incoming, outgoing) => {
  const requestUrl = `http://127.0.0.1:${port}${incoming.url}`;
  const request = new Request(requestUrl, {
    method: incoming.method,
    headers: incoming.headers
  });

  const response = await worker.fetch(request, envFromProcess());
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  outgoing.end(await response.text());
}).listen(port, "127.0.0.1", () => {
  console.log(`retail-search local server listening at http://127.0.0.1:${port}`);
});

