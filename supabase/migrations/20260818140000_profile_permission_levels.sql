-- Allow a member to hold multiple named permission levels. Capabilities union.

alter table public.profiles
  drop constraint if exists profiles_id_client_id_key;
alter table public.profiles
  add constraint profiles_id_client_id_key unique (id, client_id);

create table if not exists public.profile_permission_levels (
  profile_id uuid not null,
  permission_level_id uuid not null,
  client_id uuid not null references public.clients (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint profile_permission_levels_pkey primary key (profile_id, permission_level_id),
  constraint profile_permission_levels_profile_client_fkey
    foreign key (profile_id, client_id)
    references public.profiles (id, client_id)
    on delete cascade,
  constraint profile_permission_levels_level_client_fkey
    foreign key (permission_level_id, client_id)
    references public.permission_levels (id, client_id)
    on delete restrict
);

create index if not exists profile_permission_levels_permission_level_id_idx
  on public.profile_permission_levels (permission_level_id);
create index if not exists profile_permission_levels_client_id_idx
  on public.profile_permission_levels (client_id);

drop trigger if exists set_client_id_default on public.profile_permission_levels;
create trigger set_client_id_default
  before insert on public.profile_permission_levels
  for each row execute function public.set_row_client_id();

alter table public.profile_permission_levels enable row level security;

drop policy if exists "profile_permission_levels_select_authenticated" on public.profile_permission_levels;
create policy "profile_permission_levels_select_authenticated"
  on public.profile_permission_levels for select
  to authenticated
  using (true);

drop policy if exists "profile_permission_levels_insert_admin" on public.profile_permission_levels;
create policy "profile_permission_levels_insert_admin"
  on public.profile_permission_levels for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "profile_permission_levels_update_admin" on public.profile_permission_levels;
create policy "profile_permission_levels_update_admin"
  on public.profile_permission_levels for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "profile_permission_levels_delete_admin" on public.profile_permission_levels;
create policy "profile_permission_levels_delete_admin"
  on public.profile_permission_levels for delete
  to authenticated
  using (public.is_admin());

drop policy if exists tenant_isolation on public.profile_permission_levels;
create policy tenant_isolation
  on public.profile_permission_levels
  as restrictive
  for all
  to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

grant select, insert, update, delete on public.profile_permission_levels to authenticated;
grant all on public.profile_permission_levels to service_role;

insert into public.profile_permission_levels (profile_id, permission_level_id, client_id)
select p.id, p.permission_level_id, p.client_id
from public.profiles p
where p.permission_level_id is not null
on conflict (profile_id, permission_level_id) do nothing;

alter table public.profiles
  drop constraint if exists profiles_permission_level_client_fkey;

drop index if exists public.profiles_permission_level_id_idx;

alter table public.profiles
  drop column if exists permission_level_id;

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

create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin
     or new.is_active is distinct from old.is_active then
    if not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
    ) then
      raise exception 'Only system admins can change admin flag or active status';
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
    id, display_name, first_name, last_name, email, client_id
  )
  values (new.id, composed, meta_first, meta_last, new.email, client_uuid);

  insert into public.profile_permission_levels (profile_id, permission_level_id, client_id)
  values (new.id, level_id, client_uuid);

  return new;
end;
$$;
