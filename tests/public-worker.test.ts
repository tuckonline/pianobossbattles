import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ end: vi.fn(async () => {}), api: vi.fn(), asset: vi.fn() }));
vi.mock("pg", () => ({ Pool: class { end = mocks.end; } }));
vi.mock("../public-app/api", () => ({ createApi: () => mocks.api }));
import worker from "../public-app/worker";
const env = { APP_ORIGIN: "https://preview.example", SUPABASE_URL: "https://auth.example", SUPABASE_PUBLISHABLE_KEY: "public", HYPERDRIVE: { connectionString: "postgresql://test" }, ASSETS: { fetch: mocks.asset } };
beforeEach(() => vi.clearAllMocks());
describe("Cloudflare request adapter", () => {
  it("serves the SPA through assets without starting gameplay or database work", async () => {
    mocks.asset.mockResolvedValue(new Response("app"));
    expect(await (await worker.fetch(new Request("https://preview.example/obs/shorts"), env)).text()).toBe("app");
    expect(mocks.api).not.toHaveBeenCalled();
    expect(mocks.end).not.toHaveBeenCalled();
  });
  it("closes normal API connections and prevents caching private responses", async () => {
    mocks.api.mockResolvedValue(Response.json({ ok: true }));
    const response = await worker.fetch(new Request("https://preview.example/api/profile"), env);
    expect(mocks.end).toHaveBeenCalledOnce();
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(await response.json()).toEqual({ ok: true });
  });
  it("keeps OBS connections alive through streaming and closes after the last event", async () => {
    let source!: ReadableStreamDefaultController<Uint8Array>;
    mocks.api.mockResolvedValue(new Response(new ReadableStream({ start(c) { source = c; } }), { headers: { "Content-Type": "text/event-stream" } }));
    const response = await worker.fetch(new Request("https://preview.example/api/obs?stream=1"), env);
    const reader = response.body!.getReader();
    source.enqueue(new TextEncoder().encode("data: first\n\n"));
    await reader.read();
    expect(mocks.end).not.toHaveBeenCalled();
    source.enqueue(new TextEncoder().encode("data: second\n\n"));
    expect(new TextDecoder().decode((await reader.read()).value)).toContain("second");
    source.close();
    expect((await reader.read()).done).toBe(true);
    expect(mocks.end).toHaveBeenCalledOnce();
  });
  it("rejects oversized input before auth or database operations", async () => {
    const response = await worker.fetch(new Request("https://preview.example/api/platform", { method: "POST", body: "x".repeat(2_000_001) }), env);
    expect(response.status).toBe(413);
    expect(mocks.api).not.toHaveBeenCalled();
  });
});
