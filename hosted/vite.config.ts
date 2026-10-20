import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
export default defineConfig({
  root: resolve("hosted"),
  plugins: [react()],
  resolve: {
    alias: [
      { find: "next/link", replacement: resolve("hosted/navigation.tsx") },
      {
        find: "next/navigation",
        replacement: resolve("hosted/navigation.tsx"),
      },
      { find: /^\.\/sign-out$/, replacement: resolve("hosted/sign-out.tsx") },
      { find: "@", replacement: resolve("src") },
    ],
  },
  build: {
    outDir: resolve("dist/client"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 10000,
  },
});
