// Loopback-only development identity proxy. Never bundled into the deployed Worker.
import { createServer } from "node:http";
createServer(async (req, res) => {
  if (
    !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
      req.socket.remoteAddress,
    ) ||
    req.headers.host !== "127.0.0.1:3001"
  ) {
    res.writeHead(403).end();
    return;
  }
  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (!key.startsWith("oai-authenticated-") && key !== "host" && value)
        headers.set(key, String(value));
    }
    headers.set("oai-authenticated-user-id", "local-teacher");
    headers.set("oai-authenticated-user-email", "local@pianopath.test");
    headers.set("oai-authenticated-user-full-name", "Developer teacher");
    if (req.method === "POST") headers.set("origin", "http://127.0.0.1:8787");
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const response = await fetch(`http://127.0.0.1:8787${req.url}`, {
      method: req.method,
      headers,
      body:
        req.method === "GET" || req.method === "HEAD"
          ? undefined
          : Buffer.concat(chunks),
    });
    const responseHeaders = new Headers(response.headers);
    // fetch has already decompressed the body. Do not advertise the old encoding.
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");
    res.writeHead(response.status, Object.fromEntries(responseHeaders));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(503).end("Preview unavailable");
  }
}).listen(3001, "127.0.0.1", () => console.log("Local: http://127.0.0.1:3001"));
