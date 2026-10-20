import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
export default defineConfig({
  root: resolve("public-app"), envDir: resolve("."), publicDir: resolve("hosted/public"),
  plugins: [react()],
  resolve: { alias: [
    { find: "next/link", replacement: resolve("hosted/navigation.tsx") },
    { find: "next/navigation", replacement: resolve("hosted/navigation.tsx") },
    { find: "@", replacement: resolve("src") },
  ] },
  server: { host: "127.0.0.1", port: 5173, strictPort: true, proxy: { "/api": "http://127.0.0.1:8788" } },
  build: { outDir: resolve("dist/client"), emptyOutDir: true, chunkSizeWarningLimit: 10000 },
});
