begin;
-- Supabase's optional automatic-RLS event trigger needs no API execution grant.
-- Retain the trigger while removing direct access for public API roles.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;

create index if not exists attachments_uploader on public.attachments(uploaded_by);
create index if not exists history_actor on public.task_history(updated_by);
create index if not exists audit_actor on public.audit_logs(actor_id);
commit;
