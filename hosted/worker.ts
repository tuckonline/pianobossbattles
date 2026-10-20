import {handleShorts} from './shorts-service';
import type { D1Database, Fetcher, R2Bucket } from "@cloudflare/workers-types";
import { z } from "zod";
import { D1Platform } from "./service";
import { DomainError } from "../src/domains/auth/permissions";
import { uploadFile, readFile } from "./uploads";
import { uploadVideo } from "./video-uploads";
import { handleOverlay } from "./obs-service";
import { handleScoreSignaling } from "./obs-signaling";
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  BUCKET: R2Bucket;
  PIANOPATH_OWNER_EMAIL?: string;
  PIANOPATH_ORIGIN?: string;
}
const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/health")
      return Response.json({ service: "PianoPath", storage: "D1" });
    if (
      url.pathname === "/api/platform" ||
      url.pathname === "/api/obs" ||
      url.pathname === "/api/shorts" ||
      url.pathname === "/api/uploads" ||
      url.pathname.startsWith("/api/uploads/video/") ||
      url.pathname.startsWith("/api/files/")
    ) {
      try {
        const id = request.headers.get("oai-authenticated-user-id"),
          email = request.headers.get("oai-authenticated-user-email");
        if (!id || !email)
          throw new DomainError("Sign in with ChatGPT to continue.", 401);
        const service = new D1Platform(env.DB);
        let name =
          request.headers.get("oai-authenticated-user-full-name") ?? email;
        if (
          request.headers.get("oai-authenticated-user-full-name-encoding") ===
          "percent-encoded-utf-8"
        )
          try {
            name = decodeURIComponent(name);
          } catch {
            name = email;
          }
        if (request.method === "POST") {
          const origin = request.headers.get("origin");
          if (origin !== (env.PIANOPATH_ORIGIN ?? url.origin))
            throw new DomainError("Invalid request origin", 403);
        }
        if (url.pathname === "/api/shorts") return await handleShorts(request,env.DB,id);
        if (url.pathname === "/api/obs")
          return url.searchParams.get("rtc")==="1"
            ? await handleScoreSignaling(request,env.DB,id)
            : await handleOverlay(request, env.DB, id);
        const actor = await service.ensureUser(
          id,
          email.toLowerCase(),
          name,
          env.PIANOPATH_OWNER_EMAIL,
        );
        if (url.pathname.startsWith("/api/uploads/video/")) {
          if (request.method !== "POST")
            throw new DomainError("Method not allowed", 405);
          return Response.json(
            await uploadVideo(request, env.BUCKET, service, actor),
            {
              headers: { "Cache-Control": "no-store" },
            },
          );
        }
        if (url.pathname === "/api/uploads") {
          if (request.method !== "POST")
            throw new DomainError("Method not allowed", 405);
          return Response.json(
            await uploadFile(request, env.BUCKET, service, actor),
            {
              status: 201,
              headers: { "Cache-Control": "no-store" },
            },
          );
        }
        if (url.pathname.startsWith("/api/files/")) {
          if (!["GET", "HEAD"].includes(request.method))
            throw new DomainError("Method not allowed", 405);
          return await readFile(request, env.BUCKET, service, actor);
        }
        let result: unknown;
        if (request.method === "GET") {
          const path = url.searchParams.get("path") ?? "/student/home";
          if (path.length > 1000 || !path.startsWith("/"))
            throw new DomainError("Invalid path");
          result = await service.view(actor, path);
        } else if (request.method === "POST") {
          if (Number(request.headers.get("content-length") ?? 0) > 2000000)
            throw new DomainError("Request is too large", 413);
          const reader = request.body?.getReader();
          let size = 0;
          const chunks: Uint8Array[] = [];
          if (reader)
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              size += value.byteLength;
              if (size > 2000000) {
                await reader.cancel();
                throw new DomainError("Request is too large", 413);
              }
              chunks.push(value);
            }
          const bytes = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.length;
          }
          result = await service.command(
            actor,
            JSON.parse(new TextDecoder().decode(bytes)),
          );
        } else throw new DomainError("Method not allowed", 405);
        return Response.json(result, {
          headers: {
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch (error) {
        if (error instanceof DomainError)
          return Response.json(
            { error: error.message },
            { status: error.status, headers: { "Cache-Control": "no-store" } },
          );
        if (error instanceof z.ZodError)
          return Response.json(
            {
              error: error.issues
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join("; "),
            },
            { status: 400 },
          );
        if (error instanceof SyntaxError)
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        console.error("PianoPath request failed", error);
        return Response.json(
          { error: "Unable to load or save your data. Please retry." },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
    }
    const response = await env.ASSETS.fetch(request as never);
    if (response.status !== 404)
      return new Response(response.body as never, {
        status: response.status,
        headers: response.headers as never,
      });
    if (
      request.method !== "GET" ||
      url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/audio/") ||
      url.pathname.startsWith("/assets/")
    )
      return new Response("Not found", { status: 404 });
    const html = await env.ASSETS.fetch(
      new Request(new URL("/", url), request) as never,
    );
    const headers = new Headers(html.headers as never);
    headers.set("Cache-Control", "no-cache");
    headers.set("Permissions-Policy", "midi=(self)");
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(html.body as never, { status: html.status, headers });
  },
};

export default worker;
