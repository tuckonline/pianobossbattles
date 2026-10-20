import "dotenv/config";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { Pool } from "pg";
import { createApi } from "./api";
const origin = process.env.APP_ORIGIN ?? "http://localhost:5173";
const api = createApi(origin, process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!);
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL, max: 10, ssl: {
    rejectUnauthorized: true,
    ...(process.env.DATABASE_SSL_CA_FILE ? { ca: readFileSync(process.env.DATABASE_SSL_CA_FILE, "utf8") } : {}),
  },
}) : null;
export async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      const root = resolve("dist/client");
      const path = resolve(root, "." + decodeURIComponent(url.pathname));
      if (!path.startsWith(root + sep) && path !== root) return new Response("Not found", { status: 404 });
      const extensions: Record<string,string> = { ".js":"text/javascript", ".css":"text/css", ".png":"image/png", ".webp":"image/webp", ".svg":"image/svg+xml", ".woff2":"font/woff2", ".mp3":"audio/mpeg", ".wav":"audio/wav", ".ogg":"audio/ogg", ".pdf":"application/pdf", ".wasm":"application/wasm", ".json":"application/json" };
      try { return new Response(await readFile(path), { headers: { "Content-Type": extensions[extname(path)] ?? "application/octet-stream" } }); }
      catch { if(extname(path))return new Response("Not found",{status:404}); return new Response(await readFile(resolve(root, "index.html")), { headers: { "Content-Type": "text/html; charset=utf-8" } }); }
    }
  return api(request, pool);
}
createServer(async (req, res) => {
  try {
    const chunks: Buffer[] = []; let bytes = 0;
    for await (const chunk of req) { bytes += chunk.length; if (bytes > 2000000) { res.writeHead(413).end(); return; } chunks.push(chunk); }
    const abort = new AbortController();
    res.on("close", () => abort.abort());
    const request = new Request(new URL(req.url ?? "/", origin), {
      method: req.method, headers: new Headers(req.headers as Record<string,string>),
      body: chunks.length ? Buffer.concat(chunks) : undefined, signal: abort.signal,
    });
    const response = await handle(request);
    res.writeHead(response.status, {
      "Cache-Control":"private, no-store", "X-Content-Type-Options":"nosniff",
      "Permissions-Policy":"midi=(self)", "Referrer-Policy":"same-origin",
      ...Object.fromEntries(response.headers),
    });
    if (response.body) Readable.fromWeb(response.body as never).pipe(res); else res.end();
  } catch { if (!res.headersSent) res.writeHead(500); res.end(); }
}).listen(Number(process.env.PORT ?? 8788), "127.0.0.1", () => console.log("Piano Boss Battles API: http://localhost:8788 (local only)"));
