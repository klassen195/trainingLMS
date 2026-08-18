-- Client-named permission levels. Capabilities attach to a level row instead of
-- the fixed recruit / firefighter / captain enum.

create table if not exists public.permission_levels (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permission_levels_name_not_blank check (length(trim(name)) > 0),
  constraint permission_levels_client_id_name_key unique (client_id, name),
  constraint permission_levels_id_client_id_key unique (id, client_id)
);

create index if not exists permission_levels_client_id_sort_idx
  on public.permission_levels (client_id, sort_order, name);

create unique index if not exists permission_levels_one_default_per_client
  on public.permission_levels (client_id)
  where is_default;

create or replace function public.set_permission_levels_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists permission_levels_updated_at on public.permission_levels;
create trigger permission_levels_updated_at
  before update on public.permission_levels
  for each row
  execute function public.set_permission_levels_updated_at();

create or replace function public.permission_levels_normalize()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.name := btrim(new.name);
  if new.name = '' then
    raise exception 'Permission level name is required';
  end if;
  return new;
end;
$$;

drop trigger if exists permission_levels_normalize on public.permission_levels;
create trigger permission_levels_normalize
  before insert or update on public.permission_levels
  for each row
  execute function public.permission_levels_normalize();

create or replace function public.permission_levels_clear_other_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_default then
    update public.permission_levels
    set is_default = false
    where client_id = new.client_id
      and id <> new.id
      and is_default;
  end if;
  return new;
end;
$$;

drop trigger if exists permission_levels_clear_other_defaults on public.permission_levels;
create trigger permission_levels_clear_other_defaults
  after insert or update of is_default on public.permission_levels
  for each row
  when (new.is_default)
  execute function public.permission_levels_clear_other_defaults();

drop trigger if exists set_client_id_default on public.permission_levels;
create trigger set_client_id_default
  before insert on public.permission_levels
  for each row
  execute function public.set_row_client_id();

alter table public.permission_levels enable row level security;

drop policy if exists "permission_levels_select_authenticated" on public.permission_levels;
create policy "permission_levels_select_authenticated"
  on public.permission_levels for select
  to authenticated
  using (true);

drop policy if exists "permission_levels_insert_admin" on public.permission_levels;
create policy "permission_levels_insert_admin"
  on public.permission_levels for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "permission_levels_update_admin" on public.permission_levels;
create policy "permission_levels_update_admin"
  on public.permission_levels for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "permission_levels_delete_admin" on public.permission_levels;
create policy "permission_levels_delete_admin"
  on public.permission_levels for delete
  to authenticated
  using (public.is_admin());

drop policy if exists tenant_isolation on public.permission_levels;
create policy tenant_isolation
  on public.permission_levels
  as restrictive
  for all
  to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

-- Starter levels from the previous fixed enum, per client
insert into public.permission_levels (client_id, name, sort_order, is_default)
select c.id, v.name, v.sort_order, false
from public.clients c
cross join (
  values
    ('Recruit', 1),
    ('Firefighter', 2),
    ('Captain', 3)
) as v(name, sort_order)
on conflict (client_id, name) do nothing;

update public.permission_levels
set is_default = true
where name = 'Firefighter'
  and not exists (
    select 1
    from public.permission_levels other
    where other.client_id = permission_levels.client_id
      and other.is_default
  );

alter table public.permission_level_capabilities
  add column if not exists permission_level_id uuid;

update public.permission_level_capabilities c
set permission_level_id = pl.id
from public.permission_levels pl
where pl.client_id = c.client_id
  and (
    (c.role = 'recruit' and pl.name = 'Recruit')
    or (c.role = 'firefighter' and pl.name = 'Firefighter')
    or (c.role = 'captain' and pl.name = 'Captain')
  );

delete from public.permission_level_capabilities
where permission_level_id is null;

alter table public.permission_level_capabilities
  alter column permission_level_id set not null;

alter table public.permission_level_capabilities
  drop constraint if exists permission_level_capabilities_pkey;

alter table public.permission_level_capabilities
  drop column if exists role;

alter table public.permission_level_capabilities
  add primary key (permission_level_id, capability);

alter table public.permission_level_capabilities
  drop constraint if exists permission_level_capabilities_permission_level_client_fkey;

alter table public.permission_level_capabilities
  add constraint permission_level_capabilities_permission_level_client_fkey
  foreign key (permission_level_id, client_id)
  references public.permission_levels (id, client_id)
  on delete cascade;

create index if not exists permission_level_capabilities_client_id_idx
  on public.permission_level_capabilities (client_id);

create or replace function public.permission_levels_seed_capabilities()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.permission_level_capabilities (client_id, permission_level_id, capability, enabled)
  select new.client_id, new.id, cap, false
  from unnest(array[
    'browse_program_catalog',
    'self_enroll',
    'author_training',
    'ems_qi',
    'document_training',
    'view_apparatus',
    'view_all_ppe',
    'submit_vehicle_checks',
    'submit_maintenance',
    'manage_assets',
    'manage_locations',
    'manage_vehicle_check_templates',
    'manage_quiz_banks',
    'resolve_maintenance',
    'manage_users',
    'manage_incidents',
    'view_fleet'
  ]::text[]) as cap
  on conflict (permission_level_id, capability) do nothing;
  return new;
end;
$$;

drop trigger if exists permission_levels_seed_capabilities on public.permission_levels;
create trigger permission_levels_seed_capabilities
  after insert on public.permission_levels
  for each row
  execute function public.permission_levels_seed_capabilities();

alter table public.profiles
  add column if not exists permission_level_id uuid;

update public.profiles p
set permission_level_id = pl.id
from public.permission_levels pl
where pl.client_id = p.client_id
  and (
    (p.role = 'recruit' and pl.name = 'Recruit')
    or (p.role = 'firefighter' and pl.name = 'Firefighter')
    or (p.role = 'captain' and pl.name = 'Captain')
  );

update public.profiles p
set permission_level_id = (
  select pl.id
  from public.permission_levels pl
  where pl.client_id = p.client_id
  order by pl.is_default desc, pl.sort_order, pl.name
  limit 1
)
where p.permission_level_id is null;

alter table public.profiles
  alter column permission_level_id set not null;

create index if not exists profiles_permission_level_id_idx
  on public.profiles (permission_level_id);

alter table public.profiles
  drop constraint if exists profiles_permission_level_client_fkey;

alter table public.profiles
  add constraint profiles_permission_level_client_fkey
  foreign key (permission_level_id, client_id)
  references public.permission_levels (id, client_id);

create or replace function public.default_permission_level_id(p_client_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.permission_levels
  where client_id = p_client_id
  order by is_default desc, sort_order, name
  limit 1
$$;

revoke all on function public.default_permission_level_id(uuid) from public, anon, authenticated;
grant execute on function public.default_permission_level_id(uuid) to service_role;

revoke all on function public.permission_levels_seed_capabilities() from public, anon;
grant execute on function public.permission_levels_seed_capabilities() to authenticated, service_role;

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
        p.is_admin = true
        or exists (
          select 1
          from public.permission_level_capabilities c
          where c.client_id = p.client_id
            and c.permission_level_id = p.permission_level_id
            and c.capability = p_capability
            and c.enabled = true
        )
      )
  );
$$;

create or replace function public.is_recruit()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select false;
$$;

create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.permission_level_id is distinct from old.permission_level_id
     or new.is_admin is distinct from old.is_admin
     or new.is_active is distinct from old.is_active then
    if not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
    ) then
      raise exception 'Only system admins can change permission level, admin flag, or active status';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_first text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), '');
  meta_last text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), '');
  meta_display text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  composed text;
  client_uuid uuid := nullif(btrim(coalesce(new.raw_app_meta_data ->> 'client_id', '')), '')::uuid;
  level_id uuid;
begin
  if meta_first is not null or meta_last is not null then
    composed := nullif(btrim(concat_ws(' ', meta_first, meta_last)), '');
  else
    composed := coalesce(meta_display, split_part(new.email, '@', 1));
  end if;

  if client_uuid is null then
    raise exception 'New users must be invited with a client_id in app_metadata';
  end if;

  level_id := public.default_permission_level_id(client_uuid);
  if level_id is null then
    raise exception 'Client % has no permission levels', client_uuid;
  end if;

  insert into public.profiles (
    id, display_name, first_name, last_name, email, client_id, permission_level_id
  )
  values (new.id, composed, meta_first, meta_last, new.email, client_uuid, level_id);
  return new;
end;
$$;

create or replace function public.seed_client_permission_defaults(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' and not public.is_platform_admin() then
    raise exception 'Only platform admins can seed client permissions';
  end if;

  if exists (select 1 from public.permission_levels where client_id = p_client_id) then
    return;
  end if;

  insert into public.permission_levels (client_id, name, sort_order, is_default)
  values
    (p_client_id, 'Recruit', 1, false),
    (p_client_id, 'Firefighter', 2, false),
    (p_client_id, 'Captain', 3, false);

  update public.permission_levels
  set is_default = true
  where client_id = p_client_id
    and name = 'Firefighter';

  update public.permission_level_capabilities c
  set enabled = true
  from public.permission_levels pl
  where c.permission_level_id = pl.id
    and pl.client_id = p_client_id
    and (
      (pl.name = 'Recruit' and c.capability in ('submit_vehicle_checks', 'submit_maintenance'))
      or (
        pl.name = 'Firefighter'
        and c.capability in (
          'browse_program_catalog',
          'self_enroll',
          'document_training',
          'view_apparatus',
          'submit_vehicle_checks',
          'submit_maintenance'
        )
      )
      or (
        pl.name = 'Captain'
        and c.capability in (
          'browse_program_catalog',
          'self_enroll',
          'author_training',
          'ems_qi',
          'document_training',
          'view_apparatus',
          'submit_vehicle_checks',
          'submit_maintenance',
          'manage_incidents'
        )
      )
    );
end;
$$;

revoke all on function public.seed_client_permission_defaults(uuid) from public;
grant execute on function public.seed_client_permission_defaults(uuid) to service_role, authenticated;

alter table public.profiles drop column if exists role;

drop type if exists public.user_role;
