import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
const source = JSON.parse(
  await readFile(
    new URL("../../data/responsibilities.json", import.meta.url),
    "utf8",
  ),
);
if (!process.argv.includes("--apply")) {
  console.log(
    `Dry run: ${source.length} source responsibilities; 74 initial tasks across Ter___lt Tech and Par__i. Due dates remain unset and all records need review. Use --apply after creating profiles; no changes made.`,
  );
  process.exit(0);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the local environment.",
  );
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: profiles, error: pe } = await db
  .from("profiles")
  .select("id,full_name,role,active");
if (pe) throw pe;
for (const name of ["Omprasanth", "Sasidharan", "CS"])
  if (
    profiles.filter(
      (p) => p.full_name === name && p.role === "updater" && p.active,
    ).length !== 1
  )
    throw new Error(
      `Exactly one active updater profile named ${name} is required.`,
    );
const { error: ce } = await db.from("companies").upsert(
  [
    { name: "Ter___lt Tech", code: "TER", active: true },
    { name: "Par__i", code: "PAR", active: true },
  ],
  { onConflict: "code", ignoreDuplicates: true },
);
if (ce) throw ce;
const { data: companies, error: cq } = await db
  .from("companies")
  .select("*")
  .in("code", ["TER", "PAR"]);
if (cq) throw cq;
if (companies.some((c) => !c.active))
  throw new Error("Activate the destination companies before seeding.");
const rows = companies.flatMap((c) =>
  source.map(({ id, assigned_person, ...r }) => ({
    ...r,
    company_id: c.id,
    assigned_to: profiles.find(
      (p) => p.full_name === assigned_person && p.active,
    ).id,
    template_key: id,
    period_label: "Initial responsibility",
    due_date: null,
    status: "Pending",
    completion_date: null,
    remarks: "",
    review_required: true,
  })),
);
const { data, error } = await db
  .from("tasks")
  .upsert(rows, {
    onConflict: "company_id,template_key,period_label",
    ignoreDuplicates: true,
  })
  .select("id");
if (error) throw error;
console.log(
  `Inserted ${data.length} responsibilities. Skipped ${rows.length - data.length} already-existing company/source/period records. Source ambiguities remain flagged for admin review.`,
);
