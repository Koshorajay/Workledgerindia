import { readdir, readFile, writeFile } from "node:fs/promises";
import { setupFile, setupSql } from "../lib/setup-sql.ts";
// Run with: npm run setup:sql
const dir = new URL("../supabase/migrations/", import.meta.url);
const migrations = [];
for (const name of (await readdir(dir)).sort())
  migrations.push({ name, sql: await readFile(new URL(name, dir), "utf8") });
await writeFile(new URL(`../${setupFile}`, import.meta.url), setupSql(migrations));
console.log(`Wrote ${migrations.length} migrations to ${setupFile}.`);
