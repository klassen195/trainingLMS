-- Apparatus identity is build_number; name removed from apparatus; unit assignment history

-- Allow nullable name/station (PPE still requires name via check below)
alter table public.assets
  alter column name drop not null;

alter table public.assets
  alter column station drop not null;

-- Apparatus type is optional; PPE must not have one
alter table public.assets drop constraint if exists assets_apparatus_type_check;
alter table public.assets
  add constraint assets_apparatus_type_check check (
    (kind = 'ppe' and apparatus_type is null)
    or (kind = 'apparatus')
  );

-- Clear apparatus names (build number is the display identity)
update public.assets
set name = null
where kind = 'apparatus';

-- PPE must have a name; apparatus must not
alter table public.assets drop constraint if exists assets_name_by_kind_check;
alter table public.assets
  add constraint assets_name_by_kind_check check (
    (kind = 'ppe' and name is not null and length(trim(name)) > 0)
    or (kind = 'apparatus' and name is null)
  );

-- Apparatus must have build_number; PPE must not
alter table public.assets drop constraint if exists assets_build_number_by_kind_check;
alter table public.assets
  add constraint assets_build_number_by_kind_check check (
    (kind = 'ppe' and build_number is null)
    or (
      kind = 'apparatus'
      and build_number is not null
      and length(trim(build_number)) > 0
    )
  );

create unique index if not exists assets_apparatus_build_number_uidx
  on public.assets (build_number)
  where kind = 'apparatus';

create unique index if not exists assets_apparatus_unit_number_uidx
  on public.assets (unit_number)
  where kind = 'apparatus' and unit_number is not null;

create table if not exists public.apparatus_unit_assignments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  unit_number text not null,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz null,
  assigned_by uuid null references public.profiles (id) on delete set null,
  notes text not null default '',
  constraint apparatus_unit_assignments_dates_check check (
    unassigned_at is null or unassigned_at >= assigned_at
  )
);

create index if not exists apparatus_unit_assignments_asset_id_idx
  on public.apparatus_unit_assignments (asset_id, assigned_at desc);

create unique index if not exists apparatus_unit_assignments_open_asset_uidx
  on public.apparatus_unit_assignments (asset_id)
  where unassigned_at is null;

create unique index if not exists apparatus_unit_assignments_open_unit_uidx
  on public.apparatus_unit_assignments (unit_number)
  where unassigned_at is null;

-- Seed history from current unit assignments
insert into public.apparatus_unit_assignments (asset_id, unit_number, assigned_at, assigned_by)
select a.id, a.unit_number, a.created_at, a.created_by
from public.assets a
where a.kind = 'apparatus'
  and a.unit_number is not null
  and not exists (
    select 1
    from public.apparatus_unit_assignments h
    where h.asset_id = a.id
      and h.unassigned_at is null
  );

alter table public.apparatus_unit_assignments enable row level security;

drop policy if exists "apparatus_unit_assignments_select_visible" on public.apparatus_unit_assignments;
drop policy if exists "apparatus_unit_assignments_insert_admin" on public.apparatus_unit_assignments;
drop policy if exists "apparatus_unit_assignments_update_admin" on public.apparatus_unit_assignments;
drop policy if exists "apparatus_unit_assignments_delete_admin" on public.apparatus_unit_assignments;

create policy "apparatus_unit_assignments_select_visible"
  on public.apparatus_unit_assignments for select
  to authenticated
  using (
    exists (
      select 1
      from public.assets a
      where a.id = asset_id
        and (
          public.is_admin()
          or a.kind = 'apparatus'
        )
    )
  );

create policy "apparatus_unit_assignments_insert_admin"
  on public.apparatus_unit_assignments for insert
  to authenticated
  with check (public.is_admin());

create policy "apparatus_unit_assignments_update_admin"
  on public.apparatus_unit_assignments for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "apparatus_unit_assignments_delete_admin"
  on public.apparatus_unit_assignments for delete
  to authenticated
  using (public.is_admin());
