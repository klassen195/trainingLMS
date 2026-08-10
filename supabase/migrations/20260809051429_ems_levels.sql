-- EMS levels catalog, personnel licenses, and cleared-to-operate level on profiles

create table if not exists public.ems_levels (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  notes text not null default '',
  constraint ems_levels_name_unique unique (name),
  constraint ems_levels_name_not_blank check (length(trim(name)) > 0)
);

create index if not exists ems_levels_sort_order_idx
  on public.ems_levels (sort_order, name);
create index if not exists ems_levels_is_active_idx
  on public.ems_levels (is_active);

create or replace function public.set_ems_levels_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ems_levels_updated_at on public.ems_levels;
create trigger ems_levels_updated_at
  before update on public.ems_levels
  for each row
  execute function public.set_ems_levels_updated_at();

alter table public.ems_levels enable row level security;

drop policy if exists "ems_levels_select_authenticated" on public.ems_levels;
create policy "ems_levels_select_authenticated"
  on public.ems_levels for select
  to authenticated
  using (true);

drop policy if exists "ems_levels_insert_admin" on public.ems_levels;
create policy "ems_levels_insert_admin"
  on public.ems_levels for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "ems_levels_update_admin" on public.ems_levels;
create policy "ems_levels_update_admin"
  on public.ems_levels for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "ems_levels_delete_admin" on public.ems_levels;
create policy "ems_levels_delete_admin"
  on public.ems_levels for delete
  to authenticated
  using (public.is_admin());

-- Cleared-to-operate level on profiles
alter table public.profiles
  add column if not exists ems_cleared_level_id uuid
    references public.ems_levels (id) on delete set null;

create index if not exists profiles_ems_cleared_level_id_idx
  on public.profiles (ems_cleared_level_id);

-- Personnel EMS licenses held
create table if not exists public.personnel_ems_licenses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  ems_level_id uuid not null references public.ems_levels (id) on delete restrict,
  issued_on date,
  expires_on date,
  license_number text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint personnel_ems_licenses_profile_level_unique
    unique (profile_id, ems_level_id)
);

create index if not exists personnel_ems_licenses_profile_id_idx
  on public.personnel_ems_licenses (profile_id);

create index if not exists personnel_ems_licenses_ems_level_id_idx
  on public.personnel_ems_licenses (ems_level_id);

alter table public.personnel_ems_licenses enable row level security;

drop policy if exists "personnel_ems_licenses_select" on public.personnel_ems_licenses;
create policy "personnel_ems_licenses_select"
  on public.personnel_ems_licenses for select
  to authenticated
  using (
    profile_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = personnel_ems_licenses.profile_id
        and p.supervisor_id = auth.uid()
    )
    or public.is_battalion_chief_of(personnel_ems_licenses.profile_id)
  );

drop policy if exists "personnel_ems_licenses_insert_admin" on public.personnel_ems_licenses;
create policy "personnel_ems_licenses_insert_admin"
  on public.personnel_ems_licenses for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "personnel_ems_licenses_update_admin" on public.personnel_ems_licenses;
create policy "personnel_ems_licenses_update_admin"
  on public.personnel_ems_licenses for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "personnel_ems_licenses_delete_admin" on public.personnel_ems_licenses;
create policy "personnel_ems_licenses_delete_admin"
  on public.personnel_ems_licenses for delete
  to authenticated
  using (public.is_admin());
