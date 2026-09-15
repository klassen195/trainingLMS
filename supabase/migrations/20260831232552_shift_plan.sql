-- Shift Plan: battalion-wide and per-station items on a 48-hour shift block.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'shift_plan_scope') then
    create type public.shift_plan_scope as enum ('battalion', 'station');
  end if;
end $$;

alter table public.permission_level_capabilities
  drop constraint if exists permission_level_capabilities_capability_check;

alter table public.permission_level_capabilities
  add constraint permission_level_capabilities_capability_check check (
    capability in (
      'access_shift_exchange',
      'access_shift_plan',
      'access_programs',
      'access_assets',
      'access_personnel',
      'browse_program_catalog',
      'self_enroll',
      'author_training',
      'ems_qi',
      'document_training',
      'delete_training_reports',
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
      'view_fleet',
      'approval_tracker'
    )
  );

alter table public.capability_display_order
  drop constraint if exists capability_display_order_capability_check;

alter table public.capability_display_order
  add constraint capability_display_order_capability_check check (
    capability in (
      'access_shift_exchange',
      'access_shift_plan',
      'access_programs',
      'access_assets',
      'access_personnel',
      'browse_program_catalog',
      'self_enroll',
      'author_training',
      'ems_qi',
      'document_training',
      'delete_training_reports',
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
      'view_fleet',
      'approval_tracker'
    )
  );

create table if not exists public.shift_plan_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  shift_date date not null,
  shift_color public.shift_color not null,
  scope public.shift_plan_scope not null,
  location_id uuid references public.locations (id) on delete restrict,
  title text not null,
  notes text not null default '',
  item_date date,
  start_time time,
  end_time time,
  constraint shift_plan_items_title_nonempty check (length(trim(title)) > 0),
  constraint shift_plan_items_scope_location check (
    (scope = 'battalion' and location_id is null)
    or (scope = 'station' and location_id is not null)
  ),
  constraint shift_plan_items_item_date_in_block check (
    item_date is null
    or (item_date >= shift_date and item_date <= (shift_date + 1))
  ),
  constraint shift_plan_items_time_order check (
    start_time is null or end_time is null or end_time > start_time
  )
);

create index if not exists shift_plan_items_client_shift_idx
  on public.shift_plan_items (client_id, shift_date, scope, location_id);

create index if not exists shift_plan_items_location_id_idx
  on public.shift_plan_items (location_id);

create or replace function public.set_shift_plan_items_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shift_plan_items_updated_at on public.shift_plan_items;
create trigger shift_plan_items_updated_at
  before update on public.shift_plan_items
  for each row
  execute function public.set_shift_plan_items_updated_at();

drop trigger if exists set_client_id_default on public.shift_plan_items;
create trigger set_client_id_default
  before insert on public.shift_plan_items
  for each row
  execute function public.set_row_client_id();

alter table public.shift_plan_items enable row level security;

drop policy if exists tenant_isolation on public.shift_plan_items;
create policy tenant_isolation on public.shift_plan_items
  as restrictive for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

drop policy if exists shift_plan_items_select on public.shift_plan_items;
create policy shift_plan_items_select
  on public.shift_plan_items for select
  to authenticated
  using (public.has_capability('access_shift_plan'));

drop policy if exists shift_plan_items_insert on public.shift_plan_items;
create policy shift_plan_items_insert
  on public.shift_plan_items for insert
  to authenticated
  with check (public.has_capability('access_shift_plan'));

drop policy if exists shift_plan_items_update on public.shift_plan_items;
create policy shift_plan_items_update
  on public.shift_plan_items for update
  to authenticated
  using (public.has_capability('access_shift_plan'))
  with check (public.has_capability('access_shift_plan'));

drop policy if exists shift_plan_items_delete on public.shift_plan_items;
create policy shift_plan_items_delete
  on public.shift_plan_items for delete
  to authenticated
  using (public.has_capability('access_shift_plan'));

grant select, insert, update, delete on public.shift_plan_items to authenticated;
grant all on public.shift_plan_items to service_role;

insert into public.permission_level_capabilities (client_id, permission_level_id, capability, enabled)
select pl.client_id, pl.id, 'access_shift_plan', true
from public.permission_levels pl
on conflict (permission_level_id, capability) do nothing;

insert into public.capability_display_order (client_id, capability, sort_order, group_name, label)
select c.id, 'access_shift_plan', 2, 'Modules', 'Shift Plan'
from public.clients c
on conflict (client_id, capability) do update
set group_name = excluded.group_name,
    label = excluded.label;

with ranked as (
  select
    client_id,
    capability,
    row_number() over (
      partition by client_id
      order by
        case when group_name = 'Modules' then 0 else 1 end,
        case capability
          when 'access_shift_exchange' then 1
          when 'access_shift_plan' then 2
          else 10
        end,
        sort_order,
        capability
    ) as next_order
  from public.capability_display_order
)
update public.capability_display_order d
set sort_order = ranked.next_order
from ranked
where d.client_id = ranked.client_id
  and d.capability = ranked.capability;

create or replace function public.permission_levels_seed_capabilities()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.permission_level_capabilities (client_id, permission_level_id, capability, enabled)
  select new.client_id, new.id, cap, cap in (
    'access_shift_exchange',
    'access_shift_plan',
    'access_programs',
    'access_assets',
    'access_personnel'
  )
  from unnest(array[
    'access_shift_exchange',
    'access_shift_plan',
    'access_programs',
    'access_assets',
    'access_personnel',
    'browse_program_catalog',
    'self_enroll',
    'author_training',
    'ems_qi',
    'document_training',
    'delete_training_reports',
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
    'view_fleet',
    'approval_tracker'
  ]::text[]) as cap
  on conflict (permission_level_id, capability) do nothing;

  insert into public.capability_display_order (client_id, capability, sort_order, group_name, label)
  select new.client_id, item.capability, item.sort_order, item.group_name, item.label
  from (
    values
      ('access_shift_exchange', 1, 'Modules', 'Shift Exchange'),
      ('access_shift_plan', 2, 'Modules', 'Shift Plan'),
      ('access_programs', 3, 'Modules', 'Programs'),
      ('access_assets', 4, 'Modules', 'Assets'),
      ('access_personnel', 5, 'Modules', 'Personnel'),
      ('browse_program_catalog', 6, 'Training', 'Browse program catalog'),
      ('self_enroll', 7, 'Training', 'Self-enroll in training'),
      ('author_training', 8, 'Training', 'Author training'),
      ('ems_qi', 9, 'Training', 'EMS QI'),
      ('document_training', 10, 'Training', 'Document training'),
      ('delete_training_reports', 11, 'Training', 'Delete training reports'),
      ('approval_tracker', 12, 'Training', 'Policy Tracker'),
      ('view_apparatus', 13, 'Assets & operations', 'View apparatus inventory'),
      ('view_fleet', 14, 'Assets & operations', 'View fleet shop'),
      ('view_all_ppe', 15, 'Assets & operations', 'View all equipment'),
      ('submit_vehicle_checks', 16, 'Assets & operations', 'Submit vehicle checks'),
      ('submit_maintenance', 17, 'Assets & operations', 'Submit maintenance requests'),
      ('manage_incidents', 18, 'Assets & operations', 'Manage incidents'),
      ('manage_assets', 19, 'Administration', 'Manage assets'),
      ('manage_locations', 20, 'Administration', 'Manage locations'),
      ('manage_vehicle_check_templates', 21, 'Administration', 'Manage check templates'),
      ('manage_quiz_banks', 22, 'Administration', 'Manage quiz banks'),
      ('resolve_maintenance', 23, 'Administration', 'Resolve maintenance'),
      ('manage_users', 24, 'Administration', 'Manage users')
  ) as item(capability, sort_order, group_name, label)
  on conflict (client_id, capability) do nothing;

  return new;
end;
$$;
