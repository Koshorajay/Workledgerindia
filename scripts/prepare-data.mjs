import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (Boolean(url) !== Boolean(key))
  throw new Error(
    "Set both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, or leave both blank for the source preview.",
  );
// Never put the full source dataset in a connected application's browser bundle.
const data = url
  ? []
  : JSON.parse(
      await readFile(
        new URL("../data/responsibilities.json", import.meta.url),
        "utf8",
      ),
    );
await writeFile(
  new URL("../data/preview.generated.json", import.meta.url),
  JSON.stringify(data, null, 2) + "\n",
);
console.log(
  url
    ? "Connected build: bundled source preview removed."
    : "Read-only preview: 37 source responsibilities loaded.",
);
