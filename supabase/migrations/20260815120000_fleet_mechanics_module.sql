-- Fleet mechanics: view_fleet capability, shop workorder fields, PM schedules, RLS

alter table public.permission_level_capabilities
  drop constraint if exists permission_level_capabilities_capability_check;

alter table public.permission_level_capabilities
  add constraint permission_level_capabilities_capability_check check (
    capability in (
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
    )
  );

insert into public.permission_level_capabilities (role, capability, enabled)
values
  ('recruit', 'view_fleet', false),
  ('firefighter', 'view_fleet', false),
  ('captain', 'view_fleet', false)
on conflict (role, capability) do nothing;

drop policy if exists "assets_select_visible" on public.assets;
create policy "assets_select_visible"
  on public.assets for select
  to authenticated
  using (
    public.is_admin()
    or public.has_capability('manage_assets')
    or (
      kind = 'apparatus'
      and (
        public.has_capability('view_apparatus')
        or public.has_capability('view_fleet')
      )
    )
    or (
      kind = 'ppe'
      and (public.has_capability('view_all_ppe') or assigned_to = auth.uid())
    )
  );

do $$
begin
  if not exists (select 1 from pg_type where typname = 'maintenance_shop_status') then
    create type public.maintenance_shop_status as enum (
      'new',
      'assigned',
      'in_progress',
      'on_hold'
    );
  end if;
end $$;

alter table public.maintenance_requests
  add column if not exists assigned_to uuid null references public.profiles (id) on delete set null;

alter table public.maintenance_requests
  add column if not exists shop_status public.maintenance_shop_status not null default 'new';

alter table public.maintenance_requests
  add column if not exists shop_notes text not null default '';

create index if not exists maintenance_requests_assigned_to_idx
  on public.maintenance_requests (assigned_to);

create index if not exists maintenance_requests_shop_status_idx
  on public.maintenance_requests (shop_status)
  where status = 'open';

drop policy if exists "maintenance_requests_update_admin" on public.maintenance_requests;
drop policy if exists "maintenance_requests_update_shop" on public.maintenance_requests;
create policy "maintenance_requests_update_shop"
  on public.maintenance_requests for update
  to authenticated
  using (
    public.is_admin()
    or public.has_capability('resolve_maintenance')
    or public.has_capability('view_fleet')
  )
  with check (
    public.is_admin()
    or public.has_capability('resolve_maintenance')
    or public.has_capability('view_fleet')
  );

create or replace function public.maintenance_request_return_in_service(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req record;
  other_open integer;
begin
  if not (
    public.is_admin()
    or public.has_capability('view_fleet')
    or public.has_capability('resolve_maintenance')
  ) then
    raise exception 'Not allowed to return apparatus to service.';
  end if;

  select id, asset_id
  into req
  from public.maintenance_requests
  where id = p_request_id;

  if not found then
    raise exception 'Maintenance request not found.';
  end if;

  select count(*)
  into other_open
  from public.maintenance_requests
  where asset_id = req.asset_id
    and status = 'open'
    and service_status = 'out_of_service'
    and id is distinct from p_request_id;

  if other_open > 0 then
    raise exception 'Other open out-of-service work remains on this unit.';
  end if;

  update public.assets
  set status = 'in_service'
  where id = req.asset_id
    and status = 'out_of_service';
end;
$$;

revoke all on function public.maintenance_request_return_in_service(uuid) from public;
revoke all on function public.maintenance_request_return_in_service(uuid) from anon;
grant execute on function public.maintenance_request_return_in_service(uuid) to authenticated;

create table if not exists public.asset_maintenance_schedules (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  title text not null,
  interval_days integer not null,
  last_completed_on date null,
  next_due_on date not null,
  notes text not null default '',
  created_by uuid null references public.profiles (id) on delete set null,
  constraint asset_maintenance_schedules_title_not_blank check (length(trim(title)) > 0),
  constraint asset_maintenance_schedules_interval_positive check (interval_days > 0)
);

create index if not exists asset_maintenance_schedules_asset_next_due_idx
  on public.asset_maintenance_schedules (asset_id, next_due_on);

create index if not exists asset_maintenance_schedules_next_due_idx
  on public.asset_maintenance_schedules (next_due_on);

create index if not exists asset_maintenance_schedules_created_by_idx
  on public.asset_maintenance_schedules (created_by);

create or replace function public.set_asset_maintenance_schedules_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists asset_maintenance_schedules_updated_at on public.asset_maintenance_schedules;
create trigger asset_maintenance_schedules_updated_at
  before update on public.asset_maintenance_schedules
  for each row
  execute function public.set_asset_maintenance_schedules_updated_at();

create or replace function public.asset_maintenance_schedules_require_apparatus()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  asset_kind public.asset_kind;
begin
  select kind into asset_kind from public.assets where id = new.asset_id;
  if asset_kind is distinct from 'apparatus' then
    raise exception 'Maintenance schedules can only be created for apparatus.';
  end if;
  return new;
end;
$$;

drop trigger if exists asset_maintenance_schedules_require_apparatus
  on public.asset_maintenance_schedules;
create trigger asset_maintenance_schedules_require_apparatus
before insert or update of asset_id on public.asset_maintenance_schedules
for each row
execute function public.asset_maintenance_schedules_require_apparatus();

revoke all on function public.asset_maintenance_schedules_require_apparatus() from public;
revoke all on function public.asset_maintenance_schedules_require_apparatus() from anon;
revoke all on function public.asset_maintenance_schedules_require_apparatus() from authenticated;

alter table public.asset_maintenance_schedules enable row level security;

drop policy if exists "asset_maintenance_schedules_select" on public.asset_maintenance_schedules;
create policy "asset_maintenance_schedules_select"
  on public.asset_maintenance_schedules for select
  to authenticated
  using (
    public.is_admin()
    or public.has_capability('view_fleet')
    or public.has_capability('view_apparatus')
    or public.has_capability('manage_assets')
  );

drop policy if exists "asset_maintenance_schedules_insert" on public.asset_maintenance_schedules;
create policy "asset_maintenance_schedules_insert"
  on public.asset_maintenance_schedules for insert
  to authenticated
  with check (
    public.is_admin()
    or public.has_capability('view_fleet')
    or public.has_capability('manage_assets')
  );

drop policy if exists "asset_maintenance_schedules_update" on public.asset_maintenance_schedules;
create policy "asset_maintenance_schedules_update"
  on public.asset_maintenance_schedules for update
  to authenticated
  using (
    public.is_admin()
    or public.has_capability('view_fleet')
    or public.has_capability('manage_assets')
  )
  with check (
    public.is_admin()
    or public.has_capability('view_fleet')
    or public.has_capability('manage_assets')
  );

drop policy if exists "asset_maintenance_schedules_delete" on public.asset_maintenance_schedules;
create policy "asset_maintenance_schedules_delete"
  on public.asset_maintenance_schedules for delete
  to authenticated
  using (
    public.is_admin()
    or public.has_capability('view_fleet')
    or public.has_capability('manage_assets')
  );
