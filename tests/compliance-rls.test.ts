import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { templateSeed } from "../data/compliance-templates";
const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  om: "00000000-0000-4000-8000-000000000002",
  sasi: "00000000-0000-4000-8000-000000000003",
  company: "10000000-0000-4000-8000-000000000001",
};
test("compliance library, questionnaire and checklists are admin-managed, review-gated and audited", async () => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;`,
  );
  const dir = new URL("../supabase/migrations/", import.meta.url);
  for (const f of (await readdir(dir)).sort())
    await db.exec(await readFile(new URL(f, dir), "utf8"));
  const one = async <T>(sql: string, params: unknown[] = []) =>
    (await db.query<T>(sql, params)).rows[0];
  const count = async (sql: string, params: unknown[] = []) =>
    Number((await one<{ n: number }>(sql, params)).n);
  async function asUser(id: string) {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec("set role authenticated");
  }
  assert.equal(await count("select count(*) n from compliance_templates"), templateSeed.length);
  assert.equal(
    await count("select count(*) n from compliance_templates where review_status='Needs review' and reviewed_at is null and last_verified_on='2026-10-24'"),
    templateSeed.length,
  );
  assert.deepEqual(
    await one(`select
      (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef) as public_definers,
      has_function_privilege('anon','public.activate_compliance_checklist(uuid,jsonb)','EXECUTE') as anon_activate,
      has_function_privilege('authenticated','public.activate_compliance_checklist(uuid,jsonb)','EXECUTE') as user_activate,
      has_function_privilege('authenticated','private.guard_checklist_item()','EXECUTE') as user_guard,
      has_table_privilege('anon','public.compliance_templates','SELECT') as anon_templates,
      has_table_privilege('authenticated','public.compliance_templates','DELETE') as user_delete_templates`),
    {
      public_definers: 0,
      anon_activate: false,
      user_activate: true,
      user_guard: false,
      anon_templates: false,
      user_delete_templates: false,
    },
  );
  for (const [name, id, role] of [
    ["admin", ids.admin, "admin"],
    ["om", ids.om, "updater"],
    ["sasi", ids.sasi, "updater"],
  ]) {
    await db.query("insert into auth.users values ($1)", [id]);
    await db.query(
      "insert into profiles(id,auth_user_id,full_name,role,username) values ($1,$1,$2,$3,$2)",
      [id, name, role],
    );
  }
  await db.query("insert into companies(id,name,code) values ($1,'Test','TEST')", [ids.company]);
  const templateId = async (code: string) =>
    (await one<{ id: string }>("select id from compliance_templates where code=$1", [code])).id;
  const gstr1 = await templateId("GST-GSTR1-M");
  const gstr3b = await templateId("GST-GSTR3B-M");
  const items = (rows: [string, string][]) =>
    JSON.stringify(rows.map(([template_id, status]) => ({ template_id, status, reasons: ["GST regular taxpayer"] })));

  await asUser(ids.om);
  assert.equal(await count("select count(*) n from compliance_templates"), templateSeed.length);
  assert.equal(
    (await db.query("update compliance_templates set title='Changed' where id=$1 returning id", [gstr1])).rows.length,
    0,
  );
  await assert.rejects(
    db.query("insert into compliance_templates(code,area,title,frequency,deadline_rule,deadline_text) values('X-1','GST','Fake','Monthly','{\"kind\":\"monthly\"}','x')"),
    /row-level security/,
  );
  await assert.rejects(
    db.query("insert into company_profiles(company_id,answers) values($1,'{}')", [ids.company]),
    /row-level security/,
  );
  await assert.rejects(
    db.query("select activate_compliance_checklist($1,$2::jsonb)", [ids.company, items([[gstr1, "Active"]])]),
    /Administrator access required/,
  );
  await assert.rejects(db.query("delete from compliance_templates where id=$1", [gstr1]), /permission denied/);

  await asUser(ids.admin);
  await assert.rejects(
    db.query("select activate_compliance_checklist($1,$2::jsonb)", [ids.company, items([[gstr1, "Active"]])]),
    /Save the company questionnaire/,
  );
  await db.query(
    "insert into company_profiles(company_id,answers,updated_by,checklist_activated_by,checklist_activated_at) values($1,$2,$3,$3,now())",
    [ids.company, JSON.stringify({ entity_type: "private", gst_type: "regular" }), ids.om],
  );
  assert.deepEqual(
    await one("select updated_by,checklist_activated_by,checklist_activated_at from company_profiles"),
    { updated_by: ids.admin, checklist_activated_by: null, checklist_activated_at: null },
  );
  await assert.rejects(
    db.query("select activate_compliance_checklist($1,$2::jsonb)", [ids.company, items([[gstr1, "Active"]])]),
    /Review these templates before activation: GST-GSTR1-M/,
  );
  await assert.rejects(
    db.query("insert into company_checklist_items(company_id,template_id,status) values($1,$2,'Active')", [ids.company, gstr1]),
    /Review this compliance template/,
  );
  await assert.rejects(
    db.query(
      "insert into tasks(company_id,assigned_to,particular,frequency,template_key,period_label,compliance_template_id) values($1,$2,'GSTR-1','Monthly','tpl:GST-GSTR1-M','Oct 2026',$3)",
      [ids.company, ids.om, gstr1],
    ),
    /Only reviewed compliance templates/,
  );
  await db.query("update compliance_templates set review_status='Reviewed',reviewed_by=$2,reviewed_at='2001-01-01',last_verified_on='2001-01-01' where id=$1", [gstr1, ids.om]);
  const reviewed = await one<{ reviewed_by: string; recent: boolean; verified_today: boolean }>(
    "select reviewed_by,reviewed_at>now()-interval '1 minute' recent,last_verified_on=(now() at time zone 'Asia/Kolkata')::date verified_today from compliance_templates where id=$1",
    [gstr1],
  );
  assert.deepEqual(reviewed, { reviewed_by: ids.admin, recent: true, verified_today: true });
  await db.query("update compliance_templates set review_notes='Checked again',reviewed_by=$2 where id=$1", [gstr1, ids.om]);
  assert.equal((await one<{ reviewed_by: string }>("select reviewed_by from compliance_templates where id=$1", [gstr1])).reviewed_by, ids.admin);
  await assert.rejects(db.query("update compliance_templates set code='CHANGED' where id=$1", [gstr1]), /immutable/);
  await assert.rejects(
    db.query(
      "insert into compliance_templates(code,area,title,frequency,deadline_rule,deadline_text,official_references) values('X-LINK','GST','Bad link','Monthly','{\"kind\":\"monthly\"}','x','[{\"label\":\"Portal\",\"url\":\"javascript:alert(1)\"}]')",
    ),
    /check constraint/,
  );
  await db.query(
    "insert into compliance_templates(code,area,title,frequency,deadline_rule,deadline_text,official_references,review_status) values('X-OWN','GST','Own template','Monthly','{\"kind\":\"monthly\",\"months_after\":1,\"day\":5}','5th','[{\"label\":\"Portal\",\"url\":\"https://www.gst.gov.in/\"}]','Reviewed')",
  );
  assert.equal(
    (await one<{ reviewed_by: string }>("select reviewed_by from compliance_templates where code='X-OWN'")).reviewed_by,
    ids.admin,
  );

  assert.equal(
    (await one<{ n: number }>("select activate_compliance_checklist($1,$2::jsonb) n", [ids.company, items([[gstr1, "Active"], [gstr3b, "Excluded"]])])).n,
    2,
  );
  assert.deepEqual(
    (await db.query("select status,reviewed_by,reasons from company_checklist_items order by status")).rows,
    [
      { status: "Active", reviewed_by: ids.admin, reasons: ["GST regular taxpayer"] },
      { status: "Excluded", reviewed_by: ids.admin, reasons: ["GST regular taxpayer"] },
    ],
  );
  assert.equal(
    (await one<{ checklist_activated_by: string }>("select checklist_activated_by from company_profiles")).checklist_activated_by,
    ids.admin,
  );
  assert.equal(
    (await one<{ n: number }>("select activate_compliance_checklist($1,$2::jsonb) n", [ids.company, items([[gstr1, "Active"]])])).n,
    1,
  );
  assert.equal(await count("select count(*) n from company_checklist_items"), 2);
  await assert.rejects(
    db.query("update company_checklist_items set template_id=$1 where template_id=$2", [gstr3b, gstr1]),
    /cannot change/,
  );
  await assert.rejects(
    db.query("update company_checklist_items set default_assignee=$1 where template_id=$2", [ids.admin, gstr1]),
    /active updater/,
  );
  await db.query("update company_checklist_items set default_assignee=$1 where template_id=$2", [ids.om, gstr1]);

  const insertTask = (period: string) =>
    db.query(
      "insert into tasks(company_id,assigned_to,particular,frequency,template_key,period_label,compliance_template_id,due_date,review_required) values($1,$2,'GSTR-1','Monthly','tpl:GST-GSTR1-M',$3,$4,'2026-11-11',false) on conflict (company_id,template_key,period_label) do nothing returning id",
      [ids.company, ids.om, period, gstr1],
    );
  assert.equal((await insertTask("Oct 2026")).rows.length, 1);
  assert.equal((await insertTask("Oct 2026")).rows.length, 0);
  // Editing a reviewed template's content makes later work wait for another review.
  await db.query("update compliance_templates set deadline_text='12th of the following month',review_status='Needs review' where id=$1", [gstr1]);
  await assert.rejects(insertTask("Nov 2026"), /Only reviewed compliance templates/);
  assert.equal(await count("select count(*) n from tasks where compliance_template_id=$1", [gstr1]), 1);

  await asUser(ids.om);
  assert.equal(await count("select count(*) n from tasks"), 1);
  await db.query("update tasks set status='In Progress',remarks='Started' where template_key='tpl:GST-GSTR1-M'");
  await assert.rejects(
    db.query("update tasks set compliance_template_id=null where template_key='tpl:GST-GSTR1-M'"),
    /Updaters may change/,
  );
  assert.equal(await count("select count(*) n from company_profiles"), 0);
  assert.equal(await count("select count(*) n from company_checklist_items"), 0);
  await asUser(ids.sasi);
  assert.equal(await count("select count(*) n from tasks"), 0);

  await db.exec("reset role");
  assert.ok(
    (await count("select count(*) n from audit_logs where entity_type in ('compliance_templates','company_profiles','company_checklist_items')")) >= 8,
  );
  await db.close();
});
