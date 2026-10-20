import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dialect: "sqlite",
  schema: "./hosted/db/schema.ts",
  out: "./drizzle",
});
