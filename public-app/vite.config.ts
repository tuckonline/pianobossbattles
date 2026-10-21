import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import {privateMusicBuild} from './private-music-build';
import {brandingMetadata} from './branding-metadata';
export default defineConfig({
  root: resolve("public-app"), envDir: resolve("."), publicDir: resolve("hosted/public"),
  plugins: [privateMusicBuild(),brandingMetadata(),react()],
  resolve: { alias: [
    { find: "next/link", replacement: resolve("hosted/navigation.tsx") },
    { find: "next/navigation", replacement: resolve("hosted/navigation.tsx") },
    { find: "@", replacement: resolve("src") },
  ] },
  server: { host: "127.0.0.1", port: 5173, strictPort: true, proxy: { "/api": "http://127.0.0.1:8788" } },
  build: { outDir: resolve("dist/client"), emptyOutDir: true, copyPublicDir:false, chunkSizeWarningLimit: 10000 },
});
