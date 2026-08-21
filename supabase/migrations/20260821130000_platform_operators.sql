-- Platform operators can act in any department silo without a roster row.

alter table public.profiles
  add column if not exists is_platform_operator boolean not null default false;

create table if not exists public.platform_operator_context (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  acting_client_id uuid not null references public.clients (id),
  updated_at timestamptz not null default now()
);

alter table public.platform_operator_context enable row level security;

drop policy if exists platform_operator_context_own on public.platform_operator_context;
create policy platform_operator_context_own on public.platform_operator_context
  for all to authenticated
  using (profile_id = auth.uid() and public.is_platform_admin())
  with check (profile_id = auth.uid() and public.is_platform_admin());

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'is_platform_admin')::boolean, false);
$$;

create or replace function public.current_client_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  if public.is_platform_admin() then
    select acting_client_id into cid
    from public.platform_operator_context
    where profile_id = auth.uid();
    if cid is not null then
      return cid;
    end if;
  end if;

  begin
    cid := nullif(auth.jwt() -> 'app_metadata' ->> 'client_id', '')::uuid;
  exception when others then
    cid := null;
  end;
  if cid is not null then
    return cid;
  end if;
  select p.client_id into cid from public.profiles p where p.id = auth.uid();
  return cid;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_platform_admin()
    or exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
    );
$$;

create or replace function public.has_capability(p_capability text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        public.is_platform_admin()
        or p.is_admin = true
        or exists (
          select 1
          from public.profile_permission_levels ppl
          join public.permission_level_capabilities c
            on c.permission_level_id = ppl.permission_level_id
           and c.client_id = ppl.client_id
          where ppl.profile_id = p.id
            and c.capability = p_capability
            and c.enabled = true
        )
      )
  );
$$;

create or replace function public.switch_platform_acting_client(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform operators can switch departments.';
  end if;

  if not exists (
    select 1 from public.clients c where c.id = p_client_id and c.is_active
  ) then
    raise exception 'Department not found.';
  end if;

  insert into public.platform_operator_context (profile_id, acting_client_id)
  values (auth.uid(), p_client_id)
  on conflict (profile_id) do update
    set acting_client_id = excluded.acting_client_id,
        updated_at = now();
end;
$$;

revoke all on function public.switch_platform_acting_client(uuid) from public;
grant execute on function public.switch_platform_acting_client(uuid) to authenticated;

drop policy if exists tenant_isolation on public.profiles;
create policy tenant_isolation on public.profiles
  as restrictive for all to authenticated
  using (client_id = public.current_client_id() or id = auth.uid())
  with check (client_id = public.current_client_id() or id = auth.uid());

create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.is_platform_operator is distinct from old.is_platform_operator then
    if not public.is_platform_admin() then
      raise exception 'Only a platform operator can change platform operator access.';
    end if;
  end if;

  if new.is_admin is distinct from old.is_admin
     or new.is_active is distinct from old.is_active then
    if not public.is_admin() then
      raise exception 'Only an administrator can change admin or active status.';
    end if;
  end if;
  return new;
end;
$$;

update public.profiles p
set is_platform_operator = true
from auth.users u
where u.id = p.id
  and coalesce((u.raw_app_meta_data ->> 'is_platform_admin')::boolean, false);
