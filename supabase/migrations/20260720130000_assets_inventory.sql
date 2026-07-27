-- Assets & inventory: PPE + apparatus registry with inspection logs

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'asset_kind') then
    create type public.asset_kind as enum ('ppe', 'apparatus');
  end if;

  if not exists (select 1 from pg_type where typname = 'asset_status') then
    create type public.asset_status as enum (
      'in_service',
      'out_of_service',
      'reserve',
      'retired'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'ppe_category') then
    create type public.ppe_category as enum (
      'turnout_coat',
      'turnout_pants',
      'helmet',
      'boots',
      'gloves',
      'hood',
      'scba_facepiece',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'apparatus_type') then
    create type public.apparatus_type as enum (
      'engine',
      'ladder',
      'ambulance',
      'rescue',
      'boat',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'inspection_result') then
    create type public.inspection_result as enum (
      'pass',
      'fail',
      'needs_attention'
    );
  end if;
end $$;

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references public.profiles (id) on delete set null,

  kind public.asset_kind not null,
  name text not null,
  status public.asset_status not null default 'in_service',
  station text not null,
  manufacturer text null,
  model text null,
  serial_number text null,
  notes text not null default '',

  assigned_to uuid null references public.profiles (id) on delete set null,

  ppe_category public.ppe_category null,
  size text null,
  manufactured_on date null,
  expires_on date null,

  unit_number text null,
  apparatus_type public.apparatus_type null,
  year integer null,

  constraint assets_ppe_category_check check (
    (kind = 'ppe' and ppe_category is not null)
    or (kind = 'apparatus' and ppe_category is null)
  ),
  constraint assets_apparatus_type_check check (
    (kind = 'apparatus' and apparatus_type is not null)
    or (kind = 'ppe' and apparatus_type is null)
  )
);

create index if not exists assets_kind_idx on public.assets (kind);
create index if not exists assets_assigned_to_idx on public.assets (assigned_to);
create index if not exists assets_station_idx on public.assets (station);
create index if not exists assets_status_idx on public.assets (status);

create or replace function public.set_assets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists assets_updated_at on public.assets;
create trigger assets_updated_at
  before update on public.assets
  for each row execute function public.set_assets_updated_at();

create table if not exists public.asset_inspections (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  inspected_at timestamptz not null default now(),
  inspected_by uuid null references public.profiles (id) on delete set null,
  result public.inspection_result not null,
  notes text not null default '',
  next_due_on date null
);

create index if not exists asset_inspections_asset_id_idx on public.asset_inspections (asset_id);
create index if not exists asset_inspections_next_due_on_idx on public.asset_inspections (next_due_on);
create index if not exists asset_inspections_inspected_at_idx on public.asset_inspections (inspected_at desc);

alter table public.assets enable row level security;
alter table public.asset_inspections enable row level security;

drop policy if exists "assets_select_visible" on public.assets;
drop policy if exists "assets_insert_admin" on public.assets;
drop policy if exists "assets_update_admin" on public.assets;
drop policy if exists "assets_delete_admin" on public.assets;

create policy "assets_select_visible"
  on public.assets for select
  to authenticated
  using (
    public.is_admin()
    or kind = 'apparatus'
    or assigned_to = auth.uid()
  );

create policy "assets_insert_admin"
  on public.assets for insert
  to authenticated
  with check (public.is_admin());

create policy "assets_update_admin"
  on public.assets for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "assets_delete_admin"
  on public.assets for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "asset_inspections_select_visible" on public.asset_inspections;
drop policy if exists "asset_inspections_insert_admin" on public.asset_inspections;
drop policy if exists "asset_inspections_update_admin" on public.asset_inspections;
drop policy if exists "asset_inspections_delete_admin" on public.asset_inspections;

create policy "asset_inspections_select_visible"
  on public.asset_inspections for select
  to authenticated
  using (
    exists (
      select 1
      from public.assets a
      where a.id = asset_id
        and (
          public.is_admin()
          or a.kind = 'apparatus'
          or a.assigned_to = auth.uid()
        )
    )
  );

create policy "asset_inspections_insert_admin"
  on public.asset_inspections for insert
  to authenticated
  with check (public.is_admin());

create policy "asset_inspections_update_admin"
  on public.asset_inspections for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "asset_inspections_delete_admin"
  on public.asset_inspections for delete
  to authenticated
  using (public.is_admin());
