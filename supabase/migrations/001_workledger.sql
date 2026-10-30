-- WorkLedger. Run once in the Supabase SQL editor as postgres.
begin;
-- Internal helpers are not exposed through the Data API.
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
grant usage on schema private to authenticated,service_role;
create table public.profiles (
 id uuid primary key default gen_random_uuid(), auth_user_id uuid not null unique references auth.users(id) on delete restrict,
 full_name text not null check(length(trim(full_name))>0), display_name text not null default '',
 role text not null default 'updater' check(role in ('admin','updater')), active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.companies (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name))>0), code text not null unique,
 active boolean not null default true, created_at timestamptz not null default now()
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), assigned_to uuid not null references public.profiles(id),
 reporting_person text, category text, frequency text not null, particular text not null check(length(trim(particular))>0), objective text, activity text,
 documents_required text, timeline_text text, due_date date, status text not null default 'Pending' check(status in ('Pending','In Progress','Completed','On Hold')),
 completion_date date, remarks text not null default '', source_pdf_name text, source_reference text, source_company text,
 review_required boolean not null default true, review_flags jsonb not null default '[]'::jsonb check(jsonb_typeof(review_flags)='array'),
 period_label text not null default 'Initial responsibility', template_key text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint completion_consistent check((status='Completed' and completion_date is not null) or (status<>'Completed' and completion_date is null)),
 constraint period_unique unique(company_id,template_key,period_label)
);
create table public.task_history (
 id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id), updated_by uuid references public.profiles(id),
 old_status text,new_status text,old_remarks text,new_remarks text,update_note text,created_at timestamptz not null default now()
);
create table public.attachments (
 id uuid primary key default gen_random_uuid(),task_id uuid not null references public.tasks(id),uploaded_by uuid not null references public.profiles(id),
 file_name text not null,storage_path text not null unique,file_type text not null,created_at timestamptz not null default now()
);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(),actor_id uuid references public.profiles(id),action text not null,entity_type text not null,
 entity_id uuid not null,metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);
create index tasks_assignee on public.tasks(assigned_to);
create index tasks_company_due on public.tasks(company_id,due_date);
create index tasks_status on public.tasks(status);
create index tasks_frequency on public.tasks(frequency);
create index tasks_updated on public.tasks(updated_at desc);
create index history_task on public.task_history(task_id,created_at desc);
create index attachments_task on public.attachments(task_id);
create index audit_time on public.audit_logs(created_at desc);

create function private.current_profile_id() returns uuid language sql stable security definer set search_path='' as $$
 select id from public.profiles where auth_user_id=(select auth.uid()) and active=true
$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where auth_user_id=(select auth.uid()) and active=true and role='admin')
$$;
create function private.can_access_task(task uuid) returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and (private.is_admin() or exists(select 1 from public.tasks where id=task and assigned_to=private.current_profile_id()))
$$;
revoke all on function private.current_profile_id(),private.is_admin(),private.can_access_task(uuid) from public;
grant execute on function private.current_profile_id(),private.is_admin(),private.can_access_task(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.tasks enable row level security;
alter table public.task_history enable row level security;
alter table public.attachments enable row level security;
alter table public.audit_logs enable row level security;
revoke all on public.profiles,public.companies,public.tasks,public.task_history,public.attachments,public.audit_logs from anon,authenticated;
grant usage on schema public to authenticated,service_role;
grant all on public.profiles,public.companies,public.tasks,public.task_history,public.attachments,public.audit_logs to service_role;
grant select on public.profiles,public.companies,public.tasks,public.task_history,public.attachments,public.audit_logs to authenticated;
grant insert,update on public.profiles,public.companies,public.tasks to authenticated;
grant insert,delete on public.attachments to authenticated;
create policy profiles_read on public.profiles for select to authenticated using(private.is_admin() or id=private.current_profile_id());
create policy profiles_insert on public.profiles for insert to authenticated with check(private.is_admin());
create policy profiles_update on public.profiles for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy companies_read on public.companies for select to authenticated using(private.is_admin() or exists(select 1 from public.tasks t where t.company_id=companies.id and t.assigned_to=private.current_profile_id()));
create policy companies_insert on public.companies for insert to authenticated with check(private.is_admin());
create policy companies_update on public.companies for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy tasks_read on public.tasks for select to authenticated using(private.is_admin() or assigned_to=private.current_profile_id());
create policy tasks_insert on public.tasks for insert to authenticated with check(private.is_admin());
create policy tasks_update on public.tasks for update to authenticated using(private.is_admin() or assigned_to=private.current_profile_id()) with check(private.is_admin() or assigned_to=private.current_profile_id());
create policy history_read on public.task_history for select to authenticated using(private.can_access_task(task_id));
create policy audit_read on public.audit_logs for select to authenticated using(private.is_admin());
create policy attachment_read on public.attachments for select to authenticated using(private.can_access_task(task_id));
create policy attachment_insert on public.attachments for insert to authenticated with check(
 private.can_access_task(task_id) and uploaded_by=private.current_profile_id() and
 exists(select 1 from public.tasks t where t.id=task_id and storage_path like t.company_id::text||'/'||t.id::text||'/%') and
 exists(select 1 from storage.objects o where o.bucket_id='evidence' and o.name=storage_path and o.owner_id=(select auth.uid())::text)
);
create policy attachment_delete on public.attachments for delete to authenticated using(private.is_admin());

create function private.guard_task_update() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and auth.uid() is not null and not private.is_admin() then
  if private.current_profile_id() is null or old.assigned_to<>private.current_profile_id() then raise exception 'Task access denied'; end if;
  if (to_jsonb(new)-array['status','completion_date','remarks','updated_at']) is distinct from (to_jsonb(old)-array['status','completion_date','remarks','updated_at']) then
   raise exception 'Updaters may change only status, completion date and remarks';
  end if;
 end if;
 if tg_op='UPDATE' and new.company_id<>old.company_id and exists(select 1 from public.attachments where task_id=old.id) then raise exception 'Remove existing evidence before moving this task to another company'; end if;
 if new.completion_date>(now() at time zone 'Asia/Kolkata')::date then raise exception 'Completion date cannot be in the future'; end if;
 new.updated_at=now(); return new;
end $$;
create trigger guard_task_update before insert or update on public.tasks for each row execute function private.guard_task_update();
create function private.guard_profile_update() returns trigger language plpgsql set search_path='' as $$
begin
 if new.auth_user_id<>old.auth_user_id then raise exception 'Auth identity is immutable'; end if;
 if auth.uid()=old.auth_user_id and (not new.active or new.role<>old.role) then raise exception 'Cannot deactivate or demote your own account'; end if;
 new.updated_at=now();return new;
end $$;
create trigger guard_profile_update before update on public.profiles for each row execute function private.guard_profile_update();
create function private.record_change() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid; record_id uuid; before_data jsonb; after_data jsonb;
begin
 actor=private.current_profile_id();
 if tg_op='DELETE' then record_id=old.id;before_data=to_jsonb(old);after_data=null;
 elsif tg_op='INSERT' then record_id=new.id;before_data=null;after_data=to_jsonb(new);
 else record_id=new.id;before_data=to_jsonb(old);after_data=to_jsonb(new); end if;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(actor,lower(tg_op),tg_table_name,record_id,jsonb_build_object('before',before_data,'after',after_data));
 if tg_table_name='tasks' then
  insert into public.task_history(task_id,updated_by,old_status,new_status,old_remarks,new_remarks,update_note)
  values(record_id,actor,before_data->>'status',after_data->>'status',before_data->>'remarks',after_data->>'remarks',case when tg_op='INSERT' then 'Task created' else 'Task updated' end);
 end if;
 return coalesce(new,old);
end $$;
create trigger task_audit after insert or update on public.tasks for each row execute function private.record_change();
create trigger company_audit after insert or update on public.companies for each row execute function private.record_change();
create trigger profile_audit after insert or update on public.profiles for each row execute function private.record_change();
create trigger attachment_audit after insert or delete on public.attachments for each row execute function private.record_change();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('evidence','evidence',false,10485760,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/jpeg','image/png','image/webp']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create function private.can_access_evidence(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(select 1 from public.tasks t where t.company_id::text=split_part(object_name,'/',1) and t.id::text=split_part(object_name,'/',2) and split_part(object_name,'/',3)<>'' and (private.is_admin() or t.assigned_to=private.current_profile_id()))
$$;
revoke all on function private.can_access_evidence(text) from public;
grant execute on function private.can_access_evidence(text) to authenticated;
create policy evidence_select on storage.objects for select to authenticated using(bucket_id='evidence' and private.can_access_evidence(name));
create policy evidence_insert on storage.objects for insert to authenticated with check(bucket_id='evidence' and private.can_access_evidence(name));
create policy evidence_delete on storage.objects for delete to authenticated using(bucket_id='evidence' and private.can_access_evidence(name) and (private.is_admin() or owner_id=(select auth.uid())::text) and not exists(select 1 from public.attachments a where a.storage_path=name));
-- No object UPDATE policy: evidence cannot be overwritten.
-- Trigger execution does not require exposing trigger functions to API callers.
-- Audit triggers also record trusted bootstrap/service writes, with a null actor.
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.current_profile_id(),private.is_admin(),private.can_access_task(uuid),private.can_access_evidence(text) to authenticated,service_role;
commit;
