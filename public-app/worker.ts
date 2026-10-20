import { Pool } from "pg";
import { createApi } from "./api";

interface Environment {
  APP_ORIGIN: string;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  HYPERDRIVE: { connectionString: string };
  ASSETS: { fetch(request: Request): Promise<Response> };
}
let api: ReturnType<typeof createApi> | undefined;

const worker = {
  async fetch(request: Request, env: Environment): Promise<Response> {
    if (!new URL(request.url).pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (!env.APP_ORIGIN || !env.HYPERDRIVE) return new Response("Preview is not configured", { status: 503 });
    // Bound request bodies before the shared API parses JSON. Never load local .env here.
    if (request.body) {
      const reader = request.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2_000_000) { await reader.cancel(); return new Response(null, { status: 413 }); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      request = new Request(request, { body: bytes });
    }
    api ??= createApi(env.APP_ORIGIN, env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY);
    // Sockets belong to this request; Hyperdrive handles origin pooling and verified TLS.
    const pool = new Pool({ connectionString: env.HYPERDRIVE.connectionString, max: 2, connectionTimeoutMillis: 10_000 });
    const close = () => pool.end().catch(() => undefined);
    let response: Response;
    try { response = await api(request, pool); }
    catch (error) { await close(); throw error; }
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "private, no-store, no-transform");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Permissions-Policy", "midi=(self)");
    headers.set("Referrer-Policy", "same-origin");
    headers.set("X-Robots-Tag", "noindex, nofollow");
    if (!response.body || !headers.get("Content-Type")?.includes("text/event-stream")) {
      await close();
      return new Response(response.body, { status: response.status, headers });
    }
    // OBS continues querying while its SSE stream is open. Keep the pool alive
    // until completion/cancellation, rather than closing it when headers return.
    const reader = response.body.getReader();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) { await close(); controller.close(); }
          else controller.enqueue(value);
        } catch (error) { await close(); controller.error(error); }
      },
      async cancel(reason) { try { await reader.cancel(reason); } finally { await close(); } },
    });
    return new Response(stream, { status: response.status, headers });
  },
};

export default worker;
