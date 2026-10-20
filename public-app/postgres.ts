import type { D1Database } from "@cloudflare/workers-types";
import type { Pool, PoolClient, QueryResult } from "pg";

/** Narrow SQL dialect bridge: the existing trusted evaluator keeps its transactions
 * and reward identities. Never accepts SQL from a browser or an RPC request. */
export function postgresSql(input: string) {
  let sql = input.replace(/`/g, '"').replace(/\browid\b/g, "id").replace(/LIMIT -1 OFFSET/g, "OFFSET");
  // SQLite's scalar JSON operators are used only with these typed game fields.
  sql = sql.replace(/json_extract\(([\w.]+),'(\$\.[\w]+)'\)/g, (_, source: string, path: string) => {
    const field = path.slice(2);
    const text = `(${source}::jsonb ->> '${field}')`;
    return ["accuracy", "correct", "sequence", "amount", "finishedAt", "startedAt"].includes(field) ? `${text}::numeric` : text;
  });
  sql = sql.replace(/json_each\(\?\)/g, "jsonb_array_elements(?::jsonb) AS entries(value)");
  sql = sql.replace(/MAX\((day|exercise_number)=\?\)/g, "MAX(CASE WHEN $1=? THEN 1 ELSE 0 END)");
  const table = sql.match(/^INSERT INTO (\w+)/i)?.[1];
  if (table) {
    sql = sql.replace(/MAX\(best,excluded.best\)/g, `GREATEST(${table}.best,excluded.best)`);
    sql = sql.replace(/\brevision=revision\+1/g, `revision=${table}.revision+1`);
    if (table === "battle_story_records") {
      sql = sql.replace(/(?<![\w.])(last_result|best_result)(?=::jsonb| END)/g, `${table}.$1`);
    }
    // The old event store is text; retain the same serialized event contract.
    sql = sql.replace(/,value FROM jsonb_array_elements/, ",value::text FROM jsonb_array_elements");
  }
  let index = 0;
  // Placeholders only outside SQL strings, preserving literal question marks.
  sql = sql.replace(/'(?:''|[^'])*'|\?/g, match => match === "?" ? `$${++index}` : match);
  // Preserve camelCase response aliases used by the OBS transport.
  sql = sql.replace(/\bAS ([a-z]\w*[A-Z]\w*)/g, 'AS "$1"');
  return sql;
}

type Executor = { query(sql: string, values?: unknown[]): Promise<QueryResult> };
class Statement {
  constructor(readonly db: PostgresBridge, readonly sql: string, readonly values: unknown[] = []) {}
  bind(...values: unknown[]) { return new Statement(this.db, this.sql, values); }
  async all() {
    const r = await this.db.query(this.sql, this.values);
    return { results: r.rows, success: true, meta: { changes: r.rowCount ?? 0 } };
  }
  async first(column?: string) {
    const row = (await this.all()).results[0];
    return column ? row?.[column] ?? null : row ?? null;
  }
  async run() { return this.all(); }
}
export class PostgresBridge {
  constructor(readonly pool: Pool | Executor, private client?: PoolClient, private userId = "local-test") {}
  prepare(sql: string) { return new Statement(this, sql); }
  query(sql: string, values: unknown[] = []) {
    return (this.client ?? this.pool).query(postgresSql(sql), values);
  }
  async batch(statements: Statement[]) {
    const client = "connect" in this.pool ? await this.pool.connect() : this.pool;
    try {
      await client.query("BEGIN");
      // Lock progression mutations across checkpoints, settings, and retries.
      // Guard checks run AFTER acquiring the lock, preserving optimistic revision checks.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [this.userId]);
      const result = [];
      for (const s of statements) {
        const r = await client.query(postgresSql(s.sql), s.values);
        result.push({ results: r.rows, success: true, meta: { changes: r.rowCount ?? 0 } });
      }
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { if ("release" in client) (client as PoolClient).release(); }
  }
  asD1() { return this as unknown as D1Database; }
}
