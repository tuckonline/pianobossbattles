import "dotenv/config";
import { db } from "../src/lib/db";
import { readFileSync, readdirSync } from "node:fs";
import { sql } from "drizzle-orm";
// Append-only migrations, each applied atomically. Run once before starting the app.
await db.execute(
  sql`CREATE TABLE IF NOT EXISTS pianopath_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
);
for (const name of readdirSync("postgres/drizzle")
  .filter((n) => n.endsWith(".sql"))
  .sort()) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(716284)`);
    const existing = await tx.execute(
      sql`SELECT name FROM pianopath_migrations WHERE name=${name}`,
    );
    if (existing.rows.length) return;
    const statements = readFileSync(`postgres/drizzle/${name}`, "utf8").split(
      "--> statement-breakpoint",
    );
    for (const statement of statements)
      if (statement.trim()) await tx.execute(sql.raw(statement));
    await tx.execute(
      sql`INSERT INTO pianopath_migrations(name) VALUES (${name})`,
    );
    console.log(`Applied ${name}`);
  });
}
process.exit(0);
