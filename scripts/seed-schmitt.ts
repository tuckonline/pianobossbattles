import { readFileSync, writeFileSync } from "node:fs";
import { schmittLibrary } from "../hosted/schmitt-library";

// Generates the pending import migration. Published migrations are immutable.
const path = "drizzle/0004_lethal_star_brand.sql";
const marker = "-- Schmitt Op. 16 numbered exercises 1–213";
const original = readFileSync(path, "utf8")
  .split(marker)[0]
  .replace(/\s*--> statement-breakpoint\s*$/, "")
  .trimEnd();
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const source =
  "https://pianoexercises.org/exercises/schmitt/schmitt-preparatory-exercises-op-16.pdf";
const inserts = schmittLibrary.map(
  (e) =>
    `INSERT INTO practice_exercises (number,collection,source_number,title,source_url,source_page,definition) VALUES (${e.number},'schmitt-op16',${e.number - 2000},${quote(e.title!)},${quote(source)},${e.sourcePage},${quote(JSON.stringify(e))});`,
);
writeFileSync(
  path,
  `${original}\n--> statement-breakpoint\n${marker}\n${inserts.join("\n--> statement-breakpoint\n")}\n`,
);
console.log(`Prepared ${inserts.length} Schmitt exercises.`);
