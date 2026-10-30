import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { templateSeed } from "../data/compliance-templates";
import { setupSql } from "../lib/setup-sql";
const adminId = "00000000-0000-4000-8000-000000000001";
test("the all-in-one setup SQL builds a new project in one transaction", async () => {
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const migrations = await Promise.all(
    (await readdir(dir)).sort().map(async (name) => ({
      name,
      sql: await readFile(new URL(name, dir), "utf8"),
    })),
  );
  const file = setupSql(migrations);

  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;`,
  );
  const count = async (sql: string) =>
    Number((await db.query<{ n: number }>(sql)).rows[0].n);
  // A failed run leaves its transaction open on this single session; roll it back as a closed connection would.
  const rejected = async (pattern: RegExp) => {
    await assert.rejects(db.exec(file), pattern);
    await db.exec("rollback");
  };

  await rejected(/Create the Auth user admin@workledger.invalid/);
  await db.query("insert into auth.users(id,email) values ($1,'admin@workledger.invalid')", [adminId]);

  // A clash late in the script (migration 4) must undo the earlier migrations too.
  await db.exec("create table public.company_profiles(id int)");
  await rejected(/relation "company_profiles" already exists/);
  assert.equal(await count("select count(*) n from pg_namespace where nspname='private'"), 0);
  assert.equal(await count("select count(*) n from pg_class where relname='profiles'"), 0);
  await db.exec("drop table public.company_profiles");

  await db.exec(file);
  await db.exec("rollback"); // nothing to undo: the file committed
  assert.equal(await count("select count(*) n from compliance_templates"), templateSeed.length);
  assert.deepEqual((await db.query("select username,role,auth_user_id from profiles")).rows, [
    { username: "admin", role: "admin", auth_user_id: adminId },
  ]);
  assert.equal(await count("select count(*) n from storage.buckets where id='evidence' and not public"), 1);

  await rejected(/WorkLedger tables already exist/);
  assert.equal(await count("select count(*) n from profiles"), 1);
});
