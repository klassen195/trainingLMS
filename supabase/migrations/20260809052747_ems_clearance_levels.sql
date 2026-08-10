-- Separate catalog for EMS cleared-to-operate levels

create table if not exists public.ems_clearance_levels (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  notes text not null default '',
  constraint ems_clearance_levels_name_unique unique (name),
  constraint ems_clearance_levels_name_not_blank check (length(trim(name)) > 0)
);

create index if not exists ems_clearance_levels_sort_order_idx
  on public.ems_clearance_levels (sort_order, name);
create index if not exists ems_clearance_levels_is_active_idx
  on public.ems_clearance_levels (is_active);

create or replace function public.set_ems_clearance_levels_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ems_clearance_levels_updated_at on public.ems_clearance_levels;
create trigger ems_clearance_levels_updated_at
  before update on public.ems_clearance_levels
  for each row
  execute function public.set_ems_clearance_levels_updated_at();

alter table public.ems_clearance_levels enable row level security;

drop policy if exists "ems_clearance_levels_select_authenticated" on public.ems_clearance_levels;
create policy "ems_clearance_levels_select_authenticated"
  on public.ems_clearance_levels for select
  to authenticated
  using (true);

drop policy if exists "ems_clearance_levels_insert_admin" on public.ems_clearance_levels;
create policy "ems_clearance_levels_insert_admin"
  on public.ems_clearance_levels for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "ems_clearance_levels_update_admin" on public.ems_clearance_levels;
create policy "ems_clearance_levels_update_admin"
  on public.ems_clearance_levels for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "ems_clearance_levels_delete_admin" on public.ems_clearance_levels;
create policy "ems_clearance_levels_delete_admin"
  on public.ems_clearance_levels for delete
  to authenticated
  using (public.is_admin());

-- Re-point profiles.ems_cleared_level_id from ems_levels to ems_clearance_levels
update public.profiles
set ems_cleared_level_id = null
where ems_cleared_level_id is not null;

alter table public.profiles
  drop constraint if exists profiles_ems_cleared_level_id_fkey;

alter table public.profiles
  add constraint profiles_ems_cleared_level_id_fkey
  foreign key (ems_cleared_level_id)
  references public.ems_clearance_levels (id)
  on delete set null;
