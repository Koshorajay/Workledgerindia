import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  om: "00000000-0000-4000-8000-000000000002",
  sasi: "00000000-0000-4000-8000-000000000003",
  cs: "00000000-0000-4000-8000-000000000004",
  company: "10000000-0000-4000-8000-000000000001",
  t1: "20000000-0000-4000-8000-000000000001",
  t2: "20000000-0000-4000-8000-000000000002",
  t3: "20000000-0000-4000-8000-000000000003",
};
test("PostgreSQL enforces role isolation, field protection, auditing and private evidence", async () => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;`,
  );
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/001_workledger.sql", import.meta.url),
      "utf8",
    ),
  );
  const permissions = await db.query<{
    public_definers: number;
    anonymous_private_access: boolean;
    user_audit_execution: boolean;
    user_helper_execution: boolean;
  }>(`select
    (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef) as public_definers,
    has_schema_privilege('anon','private','USAGE') as anonymous_private_access,
    has_function_privilege('authenticated','private.record_change()','EXECUTE') as user_audit_execution,
    has_function_privilege('authenticated','private.current_profile_id()','EXECUTE') as user_helper_execution`);
  assert.deepEqual(permissions.rows[0], {
    public_definers: 0,
    anonymous_private_access: false,
    user_audit_execution: false,
    user_helper_execution: true,
  });
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261009150648_restrict_auto_rls_and_index_audit_actors.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261009152320_add_username_accounts.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  for (const [name, id] of Object.entries(ids).slice(0, 4)) {
    await db.query("insert into auth.users values ($1)", [id]);
    await db.query(
      "insert into public.profiles(id,auth_user_id,full_name,role,username) values ($1,$1,$2,$3,$2)",
      [id, name, name === "admin" ? "admin" : "updater"],
    );
  }
  await db.query("insert into companies(id,name,code) values ($1,$2,$3)", [
    ids.company,
    "Test",
    "TEST",
  ]);
  for (const [tid, pid] of [
    [ids.t1, ids.om],
    [ids.t2, ids.sasi],
    [ids.t3, ids.cs],
  ])
    await db.query(
      "insert into tasks(id,company_id,assigned_to,particular,frequency) values ($1,$2,$3,$4,$5)",
      [tid, ids.company, pid, "Source duty", "Monthly"],
    );
  async function asUser(id: string) {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec("set role authenticated");
  }
  async function count(sql: string) {
    return Number((await db.query<{ n: number }>(sql)).rows[0].n);
  }
  for (const [pid, tid] of [
    [ids.om, ids.t1],
    [ids.sasi, ids.t2],
    [ids.cs, ids.t3],
  ]) {
    await asUser(pid);
    assert.equal(await count("select count(*) n from tasks"), 1);
    assert.equal(
      (await db.query<{ id: string }>("select id from tasks")).rows[0].id,
      tid,
    );
    const other = tid === ids.t1 ? ids.t2 : ids.t1;
    assert.equal(
      (
        await db.query("update tasks set remarks=$1 where id=$2 returning id", [
          "unauthorized",
          other,
        ])
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.query("update tasks set assigned_to=$1 where id=$2", [ids.admin, tid]),
      /Updaters may change/,
    );
    await assert.rejects(
      db.query("update tasks set due_date=$1 where id=$2", ["2030-01-01", tid]),
      /Updaters may change/,
    );
    await assert.rejects(
      db.query(
        "insert into tasks(company_id,assigned_to,particular,frequency) values($1,$2,'Fake','Daily')",
        [ids.company, pid],
      ),
      /row-level security/,
    );
  }
  await asUser(ids.om);
  await db.query(
    "update tasks set status='In Progress',remarks='working' where id=$1",
    [ids.t1],
  );
  assert.equal(await count("select count(*) n from task_history"), 2);
  assert.equal(await count("select count(*) n from audit_logs"), 0);
  assert.equal(
    (
      await db.query(
        "update profiles set role='admin' where id=$1 returning id",
        [ids.om],
      )
    ).rows.length,
    0,
  );
  await assert.rejects(
    db.query(
      "insert into task_history(task_id,new_status) values($1,'Completed')",
      [ids.t1],
    ),
    /permission denied/,
  );
  await assert.rejects(
    db.exec("delete from task_history"),
    /permission denied/,
  );
  await assert.rejects(
    db.exec(
      "insert into audit_logs(action,entity_type,entity_id) values('fake','tasks',gen_random_uuid())",
    ),
    /permission denied/,
  );
  const path = `${ids.company}/${ids.t1}/evidence.pdf`;
  await db.query(
    "insert into storage.objects(bucket_id,name,owner_id) values('evidence',$1,$2)",
    [path, ids.om],
  );
  await db.query(
    "insert into attachments(task_id,uploaded_by,file_name,storage_path,file_type) values($1,$2,$3,$4,$5)",
    [ids.t1, ids.om, "Evidence.pdf", path, "application/pdf"],
  );
  await asUser(ids.sasi);
  assert.equal(await count("select count(*) n from storage.objects"), 0);
  assert.equal(await count("select count(*) n from attachments"), 0);
  await assert.rejects(
    db.query(
      "insert into storage.objects(bucket_id,name,owner_id) values('evidence',$1,$2)",
      [`${ids.company}/${ids.t1}/bad.pdf`, ids.sasi],
    ),
    /row-level security/,
  );
  await asUser(ids.admin);
  await assert.rejects(
    db.query("update profiles set username='changed' where id=$1", [ids.om]),
    /Username is immutable/,
  );
  await db.query(
    "insert into companies(id,name,code) values('10000000-0000-4000-8000-000000000002','Second','SECOND')",
  );
  await assert.rejects(
    db.query(
      "update tasks set company_id='10000000-0000-4000-8000-000000000002' where id=$1",
      [ids.t1],
    ),
    /Remove existing evidence/,
  );
  assert.equal(await count("select count(*) n from tasks"), 3);
  assert.ok((await count("select count(*) n from audit_logs")) >= 9);
  assert.equal(
    (
      await db.query("delete from storage.objects where name=$1 returning id", [
        path,
      ])
    ).rows.length,
    0,
  );
  await assert.rejects(
    db.query(
      "insert into tasks(company_id,assigned_to,particular,frequency,status,completion_date) values($1,$2,'Future','Daily','Completed','2999-01-01')",
      [ids.company, ids.om],
    ),
    /future/,
  );
  await assert.rejects(
    db.query("update profiles set active=false where id=$1", [ids.admin]),
    /own account/,
  );
  await db.query("delete from attachments where storage_path=$1", [path]);
  assert.equal(
    (
      await db.query("delete from storage.objects where name=$1 returning id", [
        path,
      ])
    ).rows.length,
    1,
  );
  await db.query("update profiles set active=false where id=$1", [ids.om]);
  await asUser(ids.om);
  assert.equal(await count("select count(*) n from tasks"), 0);
  assert.equal(await count("select count(*) n from profiles"), 0);
  assert.equal(await count("select count(*) n from companies"), 0);
  await db.exec("reset role");
  assert.equal(
    (
      await db.query<{ public: boolean }>(
        "select public from storage.buckets where id='evidence'",
      )
    ).rows[0].public,
    false,
  );
  await db.close();
});
