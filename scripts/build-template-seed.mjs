import { writeFile } from "node:fs/promises";
import { templateSeed } from "../data/compliance-templates.ts";
import { seedMigration, templateSeedSql } from "../lib/compliance-seed.ts";
// Run with: npm run seed:templates
await writeFile(new URL(`../${seedMigration}`, import.meta.url), templateSeedSql(templateSeed));
console.log(`Wrote ${templateSeed.length} templates to ${seedMigration}.`);
