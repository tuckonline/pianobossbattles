import "dotenv/config";
import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import { drizzle as liteDrizzle } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema";
function createDatabase() {
  if (process.env.DATABASE_URL)
    return pgDrizzle(new Pool({ connectionString: process.env.DATABASE_URL }), {
      schema,
    });
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.ALLOW_LOCAL_DATABASE
  )
    throw new Error("DATABASE_URL is required in production");
  const path = process.env.PGLITE_DIR ?? ".local/database";
  mkdirSync(dirname(path), { recursive: true });
  return liteDrizzle(new PGlite(path), { schema });
}
const globalDb = globalThis as unknown as {
  pianoDb?: ReturnType<typeof createDatabase>;
};
export const db = (globalDb.pianoDb ??= createDatabase());
export type Database = typeof db;
