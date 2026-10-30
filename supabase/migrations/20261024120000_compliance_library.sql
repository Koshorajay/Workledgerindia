-- Compliance template library, company setup questionnaire and company checklists.
-- Apply once, after the earlier WorkLedger migrations, to this copy's own Supabase project.
begin;
create table public.compliance_templates (
 id uuid primary key default gen_random_uuid(), code text not null unique check(code ~ '^[A-Z0-9][A-Z0-9-]{1,47}$'),
 area text not null check(area in ('GST','Income Tax','Company / ROC')), title text not null check(length(trim(title))>0), form_name text,
 description text not null default '', objective text, activity text,
 frequency text not null check(frequency in ('Monthly','Quarterly','Half-yearly','Annually','Event-based','One-time')),
 deadline_rule jsonb not null check(jsonb_typeof(deadline_rule)='object' and deadline_rule->>'kind' in ('monthly','quarterly','half_yearly','annual','after_event','event')),
 deadline_text text not null check(length(trim(deadline_text))>0),
 required_documents jsonb not null default '[]'::jsonb check(jsonb_typeof(required_documents)='array' and not jsonb_path_exists(required_documents,'$[*] ? (@.type() != "string")')),
 official_references jsonb not null default '[]'::jsonb check(jsonb_typeof(official_references)='array' and not jsonb_path_exists(official_references,'$[*] ? (!exists(@.label) || (exists(@.url) && !(@.url like_regex "^https://[^ ]+$")))')),
 applicability jsonb not null default '{}'::jsonb check(jsonb_typeof(applicability)='object'),
 review_status text not null default 'Needs review' check(review_status in ('Needs review','Reviewed','Retired')),
 review_notes text not null default '', last_verified_on date,
 reviewed_by uuid references public.profiles(id), reviewed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint template_review_stamp check((review_status='Reviewed')=(reviewed_at is not null))
);
create table public.company_profiles (
 id uuid primary key default gen_random_uuid(), company_id uuid not null unique references public.companies(id),
 answers jsonb not null default '{}'::jsonb check(jsonb_typeof(answers)='object'), questionnaire_version integer not null default 1,
 updated_by uuid references public.profiles(id), checklist_activated_by uuid references public.profiles(id), checklist_activated_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.company_checklist_items (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 template_id uuid not null references public.compliance_templates(id),
 status text not null check(status in ('Active','Excluded')), origin text not null default 'Suggested' check(origin in ('Suggested','Added manually')),
 reasons jsonb not null default '[]'::jsonb check(jsonb_typeof(reasons)='array'), note text not null default '',
 default_assignee uuid references public.profiles(id), reviewed_by uuid references public.profiles(id), reviewed_at timestamptz not null default now(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint checklist_unique unique(company_id,template_id)
);
alter table public.tasks add column compliance_template_id uuid references public.compliance_templates(id);
create index tasks_compliance_template on public.tasks(compliance_template_id);
create index templates_reviewer on public.compliance_templates(reviewed_by);
create index company_profiles_updater on public.company_profiles(updated_by);
create index company_profiles_activator on public.company_profiles(checklist_activated_by);
create index checklist_template on public.company_checklist_items(template_id);
create index checklist_assignee on public.company_checklist_items(default_assignee);
create index checklist_reviewer on public.company_checklist_items(reviewed_by);

-- Saving a template as Reviewed records the real reviewer; any other status clears the review.
create function private.guard_template_change() returns trigger language plpgsql set search_path='' as $$
declare stamp boolean := tg_op='INSERT';
begin
 if tg_op='UPDATE' then
  if new.code<>old.code then raise exception 'Template code is immutable'; end if;
  new.created_at=old.created_at;
  stamp := old.review_status<>'Reviewed' or (to_jsonb(new)-array['review_status','review_notes','last_verified_on','reviewed_by','reviewed_at','created_at','updated_at'])
   is distinct from (to_jsonb(old)-array['review_status','review_notes','last_verified_on','reviewed_by','reviewed_at','created_at','updated_at']);
 end if;
 if new.review_status<>'Reviewed' then new.reviewed_by=null; new.reviewed_at=null;
 elsif stamp then new.reviewed_by=private.current_profile_id(); new.reviewed_at=now(); new.last_verified_on=(now() at time zone 'Asia/Kolkata')::date;
 else new.reviewed_by=old.reviewed_by; new.reviewed_at=old.reviewed_at; new.last_verified_on=old.last_verified_on;
 end if;
 new.updated_at=now(); return new;
end $$;
create trigger guard_template_change before insert or update on public.compliance_templates for each row execute function private.guard_template_change();
create function private.guard_company_profile() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then
  new.updated_by=private.current_profile_id(); new.checklist_activated_by=null; new.checklist_activated_at=null;
 else
  if new.company_id<>old.company_id then raise exception 'A questionnaire belongs to one company'; end if;
  new.created_at=old.created_at;
  if new.answers is distinct from old.answers then new.updated_by=private.current_profile_id(); else new.updated_by=old.updated_by; end if;
  if new.checklist_activated_at is distinct from old.checklist_activated_at then
   new.checklist_activated_at=now(); new.checklist_activated_by=private.current_profile_id();
  else new.checklist_activated_by=old.checklist_activated_by; end if;
 end if;
 new.updated_at=now(); return new;
end $$;
create trigger guard_company_profile before insert or update on public.company_profiles for each row execute function private.guard_company_profile();
create function private.guard_checklist_item() returns trigger language plpgsql set search_path='' as $$
declare changed boolean := tg_op='INSERT';
begin
 if tg_op='UPDATE' then
  if new.company_id<>old.company_id or new.template_id<>old.template_id then raise exception 'Checklist company and template cannot change'; end if;
  new.created_at=old.created_at;
  changed := new.status<>old.status or new.note<>old.note or new.reviewed_at is distinct from old.reviewed_at;
 end if;
 if new.status='Active' and (tg_op='INSERT' or old.status<>'Active') and not exists(select 1 from public.compliance_templates t where t.id=new.template_id and t.review_status='Reviewed') then
  raise exception 'Review this compliance template in the library before activating it';
 end if;
 if new.default_assignee is not null and (tg_op='INSERT' or new.default_assignee is distinct from old.default_assignee)
  and not exists(select 1 from public.profiles p where p.id=new.default_assignee and p.role='updater' and p.active) then
  raise exception 'Default assignee must be an active updater';
 end if;
 if changed then new.reviewed_by=private.current_profile_id(); new.reviewed_at=now();
 else new.reviewed_by=old.reviewed_by; new.reviewed_at=old.reviewed_at; end if;
 new.updated_at=now(); return new;
end $$;
create trigger guard_checklist_item before insert or update on public.company_checklist_items for each row execute function private.guard_checklist_item();
-- Same rules as before, plus: work can be created from reviewed templates only.
create or replace function private.guard_task_update() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and auth.uid() is not null and not private.is_admin() then
  if private.current_profile_id() is null or old.assigned_to<>private.current_profile_id() then raise exception 'Task access denied'; end if;
  if (to_jsonb(new)-array['status','completion_date','remarks','updated_at']) is distinct from (to_jsonb(old)-array['status','completion_date','remarks','updated_at']) then
   raise exception 'Updaters may change only status, completion date and remarks';
  end if;
 end if;
 if tg_op='UPDATE' and new.company_id<>old.company_id and exists(select 1 from public.attachments where task_id=old.id) then raise exception 'Remove existing evidence before moving this task to another company'; end if;
 if new.completion_date>(now() at time zone 'Asia/Kolkata')::date then raise exception 'Completion date cannot be in the future'; end if;
 if new.compliance_template_id is not null and (tg_op='INSERT' or new.compliance_template_id is distinct from old.compliance_template_id)
  and not exists(select 1 from public.compliance_templates t where t.id=new.compliance_template_id and t.review_status='Reviewed') then
  raise exception 'Only reviewed compliance templates can create work';
 end if;
 new.updated_at=now(); return new;
end $$;
create trigger template_audit after insert or update on public.compliance_templates for each row execute function private.record_change();
create trigger company_profile_audit after insert or update on public.company_profiles for each row execute function private.record_change();
create trigger checklist_audit after insert or update on public.company_checklist_items for each row execute function private.record_change();

alter table public.compliance_templates enable row level security;
alter table public.company_profiles enable row level security;
alter table public.company_checklist_items enable row level security;
revoke all on public.compliance_templates,public.company_profiles,public.company_checklist_items from anon,authenticated;
grant all on public.compliance_templates,public.company_profiles,public.company_checklist_items to service_role;
grant select,insert,update on public.compliance_templates,public.company_profiles,public.company_checklist_items to authenticated;
-- Updaters may read templates so their tasks can show official references.
create policy templates_read on public.compliance_templates for select to authenticated using(private.current_profile_id() is not null);
create policy templates_insert on public.compliance_templates for insert to authenticated with check(private.is_admin());
create policy templates_update on public.compliance_templates for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy company_profiles_read on public.company_profiles for select to authenticated using(private.is_admin());
create policy company_profiles_insert on public.company_profiles for insert to authenticated with check(private.is_admin());
create policy company_profiles_update on public.company_profiles for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy checklist_read on public.company_checklist_items for select to authenticated using(private.is_admin());
create policy checklist_insert on public.company_checklist_items for insert to authenticated with check(private.is_admin());
create policy checklist_update on public.company_checklist_items for update to authenticated using(private.is_admin()) with check(private.is_admin());

-- Saves an administrator's reviewed checklist for one company in a single transaction.
create function public.activate_compliance_checklist(p_company_id uuid, p_items jsonb) returns integer
language plpgsql set search_path='' as $$
declare saved integer; unreviewed text;
begin
 if not private.is_admin() then raise exception 'Administrator access required'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Checklist items must be a list'; end if;
 if jsonb_array_length(p_items)=0 then raise exception 'Add at least one checklist item'; end if;
 if not exists(select 1 from public.company_profiles where company_id=p_company_id) then
  raise exception 'Save the company questionnaire before activating its checklist';
 end if;
 select string_agg(t.code,', ' order by t.code) into unreviewed from jsonb_array_elements(p_items) i
  join public.compliance_templates t on t.id=(i->>'template_id')::uuid where i->>'status'='Active' and t.review_status<>'Reviewed';
 if unreviewed is not null then raise exception 'Review these templates before activation: %', unreviewed; end if;
 insert into public.company_checklist_items(company_id,template_id,status,origin,reasons,note)
 select p_company_id,(i->>'template_id')::uuid,i->>'status',coalesce(i->>'origin','Suggested'),coalesce(i->'reasons','[]'::jsonb),coalesce(i->>'note','')
 from jsonb_array_elements(p_items) i
 on conflict (company_id,template_id) do update set status=excluded.status,origin=excluded.origin,reasons=excluded.reasons,note=excluded.note,reviewed_at=now();
 get diagnostics saved=row_count;
 update public.company_profiles set checklist_activated_at=now() where company_id=p_company_id;
 return saved;
end $$;
revoke all on function public.activate_compliance_checklist(uuid,jsonb) from public,anon;
grant execute on function public.activate_compliance_checklist(uuid,jsonb) to authenticated,service_role;
revoke all on function private.guard_template_change(),private.guard_company_profile(),private.guard_checklist_item(),private.guard_task_update() from public,anon,authenticated;
commit;
