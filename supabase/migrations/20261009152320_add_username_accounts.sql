begin;
alter table public.profiles add column username text;
update public.profiles set username=case
 when role='admin' then 'admin'
 when full_name='Omprasanth' then 'omprasanth'
 when full_name='Sasidharan' then 'sasidharan'
 when full_name='CS' then 'cs'
 else 'user_'||left(replace(id::text,'-',''),16) end;
alter table public.profiles alter column username set not null;
alter table public.profiles add constraint profiles_username_format check(username ~ '^[a-z][a-z0-9_]{1,31}$');
alter table public.profiles add constraint profiles_username_key unique(username);
create or replace function private.guard_profile_update() returns trigger language plpgsql set search_path='' as $$
begin
 if new.auth_user_id<>old.auth_user_id then raise exception 'Auth identity is immutable'; end if;
 if new.username<>old.username then raise exception 'Username is immutable'; end if;
 if auth.uid()=old.auth_user_id and (not new.active or new.role<>old.role) then raise exception 'Cannot deactivate or demote your own account'; end if;
 new.updated_at=now();return new;
end $$;
revoke all on function private.guard_profile_update() from public,anon,authenticated;
commit;
