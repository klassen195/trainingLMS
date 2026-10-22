-- Rope complement: compartments and bags on apparatus, required vs actual
-- loadout, and a flat reserve cache. Serialized pieces stay on assets.

alter table public.assets
  add column if not exists tracks_rope_inventory boolean not null default false;

alter table public.assets drop constraint if exists assets_tracks_rope_inventory_check;
alter table public.assets
  add constraint assets_tracks_rope_inventory_check check (
    tracks_rope_inventory = false or kind = 'apparatus'
  );

create index if not exists assets_tracks_rope_inventory_idx
  on public.assets (station)
  where tracks_rope_inventory;

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
      'manage_upcoming_training',
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
      'approval_tracker',
      'access_professional_services',
      'access_reports',
      'edit_ems_clearance_log',
      'access_pdip',
      'verify_personnel_languages',
      'edit_own_personnel',
      'view_rope_inventory',
      'manage_rope_inventory'
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
      'manage_upcoming_training',
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
      'approval_tracker',
      'access_professional_services',
      'access_reports',
      'edit_ems_clearance_log',
      'access_pdip',
      'verify_personnel_languages',
      'edit_own_personnel',
      'view_rope_inventory',
      'manage_rope_inventory'
    )
  );

insert into public.permission_level_capabilities (client_id, permission_level_id, capability, enabled)
select pl.client_id, pl.id, cap.capability, false
from public.permission_levels pl
cross join (
  values ('view_rope_inventory'), ('manage_rope_inventory')
) as cap(capability)
on conflict (permission_level_id, capability) do nothing;

insert into public.capability_display_order (client_id, capability, sort_order, group_name, label)
select c.id, item.capability, item.sort_order, item.group_name, item.label
from public.clients c
cross join (
  values
    ('view_rope_inventory'::text, 32, 'Assets & operations'::text, 'View rope inventory'::text),
    ('manage_rope_inventory'::text, 33, 'Assets & operations'::text, 'Manage rope inventory'::text)
) as item(capability, sort_order, group_name, label)
on conflict (client_id, capability) do update
set group_name = excluded.group_name,
    label = excluded.label;

create or replace function public.permission_levels_seed_capabilities()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.permission_level_capabilities (client_id, permission_level_id, capability, enabled)
  select new.client_id, new.id, cap, cap in (
    'access_shift_exchange', 'access_shift_plan', 'access_professional_services',
    'access_programs', 'access_assets', 'access_personnel', 'access_reports',
    'access_pdip'
  )
  from unnest(array[
    'access_shift_exchange', 'access_shift_plan', 'access_programs', 'access_assets',
    'access_personnel', 'browse_program_catalog', 'self_enroll', 'author_training',
    'ems_qi', 'document_training', 'delete_training_reports', 'manage_upcoming_training',
    'view_apparatus', 'view_all_ppe', 'submit_vehicle_checks', 'submit_maintenance',
    'manage_assets', 'manage_locations', 'manage_vehicle_check_templates', 'manage_quiz_banks',
    'resolve_maintenance', 'manage_users', 'manage_incidents', 'view_fleet',
    'approval_tracker', 'access_professional_services', 'access_reports',
    'edit_ems_clearance_log', 'access_pdip', 'verify_personnel_languages', 'edit_own_personnel',
    'view_rope_inventory', 'manage_rope_inventory'
  ]::text[]) as cap
  on conflict (permission_level_id, capability) do nothing;

  insert into public.capability_display_order (client_id, capability, sort_order, group_name, label)
  select new.client_id, item.capability, item.sort_order, item.group_name, item.label
  from (values
    ('access_shift_exchange', 1, 'Modules', 'Shift Exchange'),
    ('access_shift_plan', 2, 'Modules', 'Shift Plan'),
    ('access_professional_services', 3, 'Modules', 'Professional Services'),
    ('access_programs', 4, 'Modules', 'Programs'),
    ('access_assets', 5, 'Modules', 'Assets'),
    ('access_personnel', 6, 'Modules', 'Personnel'),
    ('access_reports', 7, 'Modules', 'Reports'),
    ('access_pdip', 8, 'Modules', 'PDIP'),
    ('browse_program_catalog', 9, 'Training', 'Browse program catalog'),
    ('self_enroll', 10, 'Training', 'Self-enroll in training'),
    ('author_training', 11, 'Training', 'Author training'),
    ('ems_qi', 12, 'Training', 'EMS QI'),
    ('document_training', 13, 'Training', 'Document training'),
    ('delete_training_reports', 14, 'Training', 'Delete training reports'),
    ('manage_upcoming_training', 15, 'Training', 'Manage upcoming training'),
    ('approval_tracker', 16, 'Training', 'Policy Tracker'),
    ('view_apparatus', 17, 'Assets & operations', 'View apparatus inventory'),
    ('view_fleet', 18, 'Assets & operations', 'View fleet shop'),
    ('view_all_ppe', 19, 'Assets & operations', 'View all equipment'),
    ('submit_vehicle_checks', 20, 'Assets & operations', 'Submit vehicle checks'),
    ('submit_maintenance', 21, 'Assets & operations', 'Submit maintenance requests'),
    ('manage_incidents', 22, 'Assets & operations', 'Manage incidents'),
    ('view_rope_inventory', 32, 'Assets & operations', 'View rope inventory'),
    ('manage_rope_inventory', 33, 'Assets & operations', 'Manage rope inventory'),
    ('manage_assets', 23, 'Administration', 'Manage assets'),
    ('manage_locations', 24, 'Administration', 'Manage locations'),
    ('manage_vehicle_check_templates', 25, 'Administration', 'Manage check templates'),
    ('manage_quiz_banks', 26, 'Administration', 'Manage quiz banks'),
    ('resolve_maintenance', 27, 'Administration', 'Resolve maintenance'),
    ('manage_users', 28, 'Administration', 'Manage users'),
    ('edit_ems_clearance_log', 29, 'Administration', 'Edit EMS clearance log'),
    ('verify_personnel_languages', 30, 'Administration', 'Verify personnel languages'),
    ('edit_own_personnel', 31, 'Administration', 'Edit own personnel file')
  ) as item(capability, sort_order, group_name, label)
  on conflict (client_id, capability) do nothing;

  return new;
end;
$$;

create table if not exists public.rope_gear_types (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rope_gear_types_name_nonempty check (length(trim(name)) > 0)
);

create unique index if not exists rope_gear_types_client_name_uidx
  on public.rope_gear_types (client_id, lower(trim(name)));

create table if not exists public.rope_compartments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  apparatus_id uuid not null references public.assets (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rope_compartments_name_nonempty check (length(trim(name)) > 0)
);

create unique index if not exists rope_compartments_apparatus_name_uidx
  on public.rope_compartments (apparatus_id, lower(trim(name)));
create index if not exists rope_compartments_apparatus_idx
  on public.rope_compartments (apparatus_id, sort_order);

create table if not exists public.rope_bags (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  compartment_id uuid not null references public.rope_compartments (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rope_bags_name_nonempty check (length(trim(name)) > 0)
);

create unique index if not exists rope_bags_compartment_name_uidx
  on public.rope_bags (compartment_id, lower(trim(name)));
create index if not exists rope_bags_compartment_idx
  on public.rope_bags (compartment_id, sort_order);

create table if not exists public.rope_bag_lines (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  bag_id uuid not null references public.rope_bags (id) on delete cascade,
  gear_type_id uuid not null references public.rope_gear_types (id) on delete restrict,
  expected_quantity integer not null default 0,
  quantity_on_hand integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rope_bag_lines_expected_nonnegative check (expected_quantity >= 0),
  constraint rope_bag_lines_on_hand_nonnegative check (quantity_on_hand >= 0),
  constraint rope_bag_lines_bag_type_uidx unique (bag_id, gear_type_id)
);

create index if not exists rope_bag_lines_bag_idx on public.rope_bag_lines (bag_id);
create index if not exists rope_bag_lines_gear_type_idx on public.rope_bag_lines (gear_type_id);

create table if not exists public.rope_placements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  gear_type_id uuid not null references public.rope_gear_types (id) on delete restrict,
  bag_id uuid null references public.rope_bags (id) on delete restrict,
  in_cache boolean not null default false,
  created_at timestamptz not null default now(),
  constraint rope_placements_asset_uidx unique (asset_id),
  constraint rope_placements_location_check check (
    (in_cache = true and bag_id is null)
    or (in_cache = false and bag_id is not null)
  )
);

create index if not exists rope_placements_bag_idx on public.rope_placements (bag_id);
create index if not exists rope_placements_gear_type_idx on public.rope_placements (gear_type_id);
create index if not exists rope_placements_cache_idx
  on public.rope_placements (client_id)
  where in_cache;

create table if not exists public.rope_cache_stock (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  gear_type_id uuid not null references public.rope_gear_types (id) on delete cascade,
  quantity integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint rope_cache_stock_quantity_nonnegative check (quantity >= 0),
  constraint rope_cache_stock_gear_type_uidx unique (gear_type_id)
);

create table if not exists public.rope_inventory_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid null references public.profiles (id) on delete set null,
  action text not null,
  gear_type_id uuid null references public.rope_gear_types (id) on delete set null,
  asset_id uuid null references public.assets (id) on delete set null,
  quantity integer not null default 1,
  from_bag_id uuid null references public.rope_bags (id) on delete set null,
  to_bag_id uuid null references public.rope_bags (id) on delete set null,
  from_cache boolean not null default false,
  to_cache boolean not null default false,
  notes text not null default '',
  constraint rope_inventory_events_action_check check (
    action in ('transfer', 'missing', 'broken', 'adjust', 'receive')
  ),
  constraint rope_inventory_events_quantity_positive check (quantity >= 1)
);

create index if not exists rope_inventory_events_client_idx
  on public.rope_inventory_events (client_id, created_at desc);

create or replace function public.rope_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rope_gear_types_updated_at on public.rope_gear_types;
create trigger rope_gear_types_updated_at
  before update on public.rope_gear_types
  for each row execute function public.rope_set_updated_at();

drop trigger if exists rope_compartments_updated_at on public.rope_compartments;
create trigger rope_compartments_updated_at
  before update on public.rope_compartments
  for each row execute function public.rope_set_updated_at();

drop trigger if exists rope_bags_updated_at on public.rope_bags;
create trigger rope_bags_updated_at
  before update on public.rope_bags
  for each row execute function public.rope_set_updated_at();

drop trigger if exists rope_bag_lines_updated_at on public.rope_bag_lines;
create trigger rope_bag_lines_updated_at
  before update on public.rope_bag_lines
  for each row execute function public.rope_set_updated_at();

drop trigger if exists rope_cache_stock_updated_at on public.rope_cache_stock;
create trigger rope_cache_stock_updated_at
  before update on public.rope_cache_stock
  for each row execute function public.rope_set_updated_at();

create or replace function public.rope_compartments_require_apparatus()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_kind public.asset_kind;
  tracking boolean;
  target_client uuid;
begin
  select kind, tracks_rope_inventory, client_id
    into target_kind, tracking, target_client
  from public.assets
  where id = new.apparatus_id;

  if target_kind is distinct from 'apparatus' or tracking is not true then
    raise exception 'Compartments belong on an apparatus that tracks rope inventory';
  end if;
  if target_client is distinct from new.client_id then
    raise exception 'Apparatus belongs to another department';
  end if;
  return new;
end;
$$;

drop trigger if exists z_rope_compartments_require_apparatus on public.rope_compartments;
create trigger z_rope_compartments_require_apparatus
  before insert or update of apparatus_id, client_id on public.rope_compartments
  for each row execute function public.rope_compartments_require_apparatus();

create or replace function public.rope_placements_check()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  asset_kind public.asset_kind;
  asset_client uuid;
  gear_client uuid;
  bag_client uuid;
begin
  select kind, client_id into asset_kind, asset_client
  from public.assets
  where id = new.asset_id;

  if asset_kind is distinct from 'ppe' then
    raise exception 'Only equipment can be placed in rope inventory';
  end if;
  if asset_client is distinct from new.client_id then
    raise exception 'Equipment belongs to another department';
  end if;

  select client_id into gear_client from public.rope_gear_types where id = new.gear_type_id;
  if gear_client is distinct from new.client_id then
    raise exception 'Gear type belongs to another department';
  end if;

  if new.bag_id is not null then
    select client_id into bag_client from public.rope_bags where id = new.bag_id;
    if bag_client is distinct from new.client_id then
      raise exception 'Bag belongs to another department';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists z_rope_placements_check on public.rope_placements;
create trigger z_rope_placements_check
  before insert or update of asset_id, gear_type_id, bag_id, client_id on public.rope_placements
  for each row execute function public.rope_placements_check();

-- Rope managers are not asset editors. These functions update only the
-- assignment and status fields that a placement move is allowed to change.
create or replace function public.rope_set_apparatus_tracking(
  p_asset_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_kind public.asset_kind;
begin
  if not public.has_capability('manage_rope_inventory') then
    raise exception 'You do not have permission to manage rope inventory';
  end if;

  select kind into target_kind
  from public.assets
  where id = p_asset_id
    and client_id = public.current_client_id();

  if target_kind is null then
    raise exception 'Apparatus not found';
  end if;
  if target_kind is distinct from 'apparatus' then
    raise exception 'Only apparatus can track rope inventory';
  end if;

  if p_enabled is not true and exists (
    select 1 from public.rope_compartments where apparatus_id = p_asset_id
  ) then
    raise exception 'Remove compartments before turning off rope inventory for this apparatus';
  end if;

  update public.assets
  set tracks_rope_inventory = p_enabled
  where id = p_asset_id;
end;
$$;

create or replace function public.rope_set_asset_location(
  p_asset_id uuid,
  p_location text,
  p_apparatus_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_kind public.asset_kind;
begin
  if not public.has_capability('manage_rope_inventory') then
    raise exception 'You do not have permission to manage rope inventory';
  end if;

  select kind into target_kind
  from public.assets
  where id = p_asset_id
    and client_id = public.current_client_id();

  if target_kind is null then
    raise exception 'Equipment not found';
  end if;
  if target_kind is distinct from 'ppe' then
    raise exception 'Only equipment can be placed in rope inventory';
  end if;

  if p_location = 'bag' then
    if p_apparatus_id is null or not exists (
      select 1
      from public.assets
      where id = p_apparatus_id
        and kind = 'apparatus'
        and tracks_rope_inventory
        and client_id = public.current_client_id()
    ) then
      raise exception 'Choose a rope apparatus';
    end if;

    update public.assets
    set status = 'in_service',
        assignment_type = 'apparatus',
        assigned_to = null,
        assigned_station = null,
        assigned_apparatus_id = p_apparatus_id
    where id = p_asset_id;
  elsif p_location = 'cache' then
    update public.assets
    set status = 'reserve',
        assignment_type = null,
        assigned_to = null,
        assigned_station = null,
        assigned_apparatus_id = null
    where id = p_asset_id;
  elsif p_location = 'out' then
    update public.assets
    set status = 'out_of_service',
        assignment_type = null,
        assigned_to = null,
        assigned_station = null,
        assigned_apparatus_id = null
    where id = p_asset_id;
  elsif p_location = 'clear' then
    update public.assets
    set status = 'in_service',
        assignment_type = null,
        assigned_to = null,
        assigned_station = null,
        assigned_apparatus_id = null
    where id = p_asset_id;
  else
    raise exception 'Unknown rope location';
  end if;
end;
$$;

revoke all on function public.rope_set_apparatus_tracking(uuid, boolean) from public;
grant execute on function public.rope_set_apparatus_tracking(uuid, boolean) to authenticated;

revoke all on function public.rope_set_asset_location(uuid, text, uuid) from public;
grant execute on function public.rope_set_asset_location(uuid, text, uuid) to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'rope_gear_types',
    'rope_compartments',
    'rope_bags',
    'rope_bag_lines',
    'rope_placements',
    'rope_cache_stock',
    'rope_inventory_events'
  ]
  loop
    execute format(
      'drop trigger if exists set_client_id_default on public.%I',
      t
    );
    execute format(
      'create trigger set_client_id_default before insert on public.%I for each row execute function public.set_row_client_id()',
      t
    );
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation on public.%I', t);
    execute format(
      'create policy tenant_isolation on public.%I as restrictive for all to authenticated using (client_id = public.current_client_id()) with check (client_id = public.current_client_id())',
      t
    );
  end loop;
end $$;

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
        or public.has_capability('manage_rope_inventory')
        or (
          tracks_rope_inventory
          and public.has_capability('view_rope_inventory')
        )
      )
    )
    or (
      kind = 'ppe'
      and (
        public.has_capability('view_all_ppe')
        or assigned_to = auth.uid()
        or public.has_capability('manage_rope_inventory')
        or (
          public.has_capability('view_rope_inventory')
          and exists (
            select 1
            from public.rope_placements rp
            where rp.asset_id = assets.id
          )
        )
      )
    )
  );

create or replace function public.rope_can_view()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_capability('view_rope_inventory')
    or public.has_capability('manage_rope_inventory');
$$;

revoke all on function public.rope_can_view() from public;
grant execute on function public.rope_can_view() to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'rope_gear_types',
    'rope_compartments',
    'rope_bags',
    'rope_bag_lines',
    'rope_placements',
    'rope_cache_stock',
    'rope_inventory_events'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.rope_can_view())',
      t || '_select',
      t
    );
  end loop;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'rope_gear_types',
    'rope_compartments',
    'rope_bags',
    'rope_bag_lines',
    'rope_placements',
    'rope_cache_stock'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.has_capability(''manage_rope_inventory''))',
      t || '_insert',
      t
    );
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.has_capability(''manage_rope_inventory'')) with check (public.has_capability(''manage_rope_inventory''))',
      t || '_update',
      t
    );
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.has_capability(''manage_rope_inventory''))',
      t || '_delete',
      t
    );
  end loop;
end $$;

drop policy if exists rope_inventory_events_insert on public.rope_inventory_events;
create policy rope_inventory_events_insert
  on public.rope_inventory_events for insert
  to authenticated
  with check (
    public.has_capability('manage_rope_inventory')
    and created_by = auth.uid()
  );
