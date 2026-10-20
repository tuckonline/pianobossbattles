import { build as viteBuild } from "vite";
import { build } from "esbuild";
import { mkdir, cp, writeFile } from "node:fs/promises";
await viteBuild({ configFile: "hosted/vite.config.ts" });
await mkdir("dist/server", { recursive: true });
await build({
  entryPoints: ["hosted/worker.ts"],
  outfile: "dist/server/index.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
});
await mkdir("dist/.openai", { recursive: true });
await cp(".openai/hosting.json", "dist/.openai/hosting.json");
await cp("drizzle", "dist/.openai/drizzle", { recursive: true });
await cp("src/app/icon.svg", "dist/client/icon.svg");
await writeFile(
  "dist/server/wrangler.json",
  JSON.stringify(
    {
      name: "pianopath",
      main: "index.js",
      compatibility_date: "2026-05-01",
      compatibility_flags: ["nodejs_compat"],
      r2_buckets: [{ binding: "BUCKET", bucket_name: "pianopath-files" }],
      assets: {
        directory: "../client",
        binding: "ASSETS",
        run_worker_first: true,
      },
      d1_databases: [
        {
          binding: "DB",
          database_name: "pianopath-local",
          database_id: "00000000-0000-4000-8000-000000000000",
          migrations_dir: "../../drizzle",
        },
      ],
    },
    null,
    2,
  ),
);
