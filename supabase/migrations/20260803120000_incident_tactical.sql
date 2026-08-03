-- ICS tactical core: incidents, org nodes, units, assignments, map overlays/placements

-- Extend capability check to include manage_incidents
alter table public.permission_level_capabilities
  drop constraint if exists permission_level_capabilities_capability_check;

alter table public.permission_level_capabilities
  add constraint permission_level_capabilities_capability_check check (
    capability in (
      'browse_program_catalog',
      'self_enroll',
      'author_training',
      'ems_qi',
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
      'manage_incidents'
    )
  );

insert into public.permission_level_capabilities (role, capability, enabled)
values
  ('recruit', 'manage_incidents', false),
  ('firefighter', 'manage_incidents', false),
  ('captain', 'manage_incidents', true)
on conflict (role, capability) do nothing;

-- Incidents
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  incident_type text not null default 'structure_fire',
  status text not null default 'active',
  location_text text,
  map_center_lng double precision not null default -116.7805,
  map_center_lat double precision not null default 47.6777,
  map_zoom double precision not null default 14,
  default_work_period_minutes integer not null default 20,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint incidents_name_nonempty check (length(trim(name)) > 0),
  constraint incidents_status_check check (status in ('active', 'closed')),
  constraint incidents_type_check check (
    incident_type in (
      'structure_fire',
      'wildland',
      'ems',
      'hazmat',
      'tech_rescue',
      'mci',
      'other'
    )
  ),
  constraint incidents_work_period_positive check (default_work_period_minutes > 0),
  constraint incidents_zoom_range check (map_zoom >= 1 and map_zoom <= 22)
);

create index if not exists incidents_status_idx on public.incidents (status);
create index if not exists incidents_created_at_idx on public.incidents (created_at desc);

create or replace function public.set_incidents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists incidents_updated_at on public.incidents;
create trigger incidents_updated_at
  before update on public.incidents
  for each row
  execute function public.set_incidents_updated_at();

alter table public.incidents enable row level security;

drop policy if exists "incidents_select_manage" on public.incidents;
create policy "incidents_select_manage"
  on public.incidents for select
  to authenticated
  using (public.has_capability('manage_incidents'));

drop policy if exists "incidents_insert_manage" on public.incidents;
create policy "incidents_insert_manage"
  on public.incidents for insert
  to authenticated
  with check (public.has_capability('manage_incidents'));

drop policy if exists "incidents_update_manage" on public.incidents;
create policy "incidents_update_manage"
  on public.incidents for update
  to authenticated
  using (public.has_capability('manage_incidents'))
  with check (public.has_capability('manage_incidents'));

drop policy if exists "incidents_delete_manage" on public.incidents;
create policy "incidents_delete_manage"
  on public.incidents for delete
  to authenticated
  using (public.has_capability('manage_incidents'));

-- Org nodes (ICS tree)
create table if not exists public.incident_org_nodes (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  parent_id uuid references public.incident_org_nodes (id) on delete cascade,
  node_type text not null,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint incident_org_nodes_name_nonempty check (length(trim(name)) > 0),
  constraint incident_org_nodes_type_check check (
    node_type in ('section', 'branch', 'division', 'group')
  )
);

create index if not exists incident_org_nodes_incident_id_idx
  on public.incident_org_nodes (incident_id);
create index if not exists incident_org_nodes_parent_id_idx
  on public.incident_org_nodes (parent_id);

alter table public.incident_org_nodes enable row level security;

drop policy if exists "incident_org_nodes_select" on public.incident_org_nodes;
create policy "incident_org_nodes_select"
  on public.incident_org_nodes for select
  to authenticated
  using (public.has_capability('manage_incidents'));

drop policy if exists "incident_org_nodes_insert" on public.incident_org_nodes;
create policy "incident_org_nodes_insert"
  on public.incident_org_nodes for insert
  to authenticated
  with check (public.has_capability('manage_incidents'));

drop policy if exists "incident_org_nodes_update" on public.incident_org_nodes;
create policy "incident_org_nodes_update"
  on public.incident_org_nodes for update
  to authenticated
  using (public.has_capability('manage_incidents'))
  with check (public.has_capability('manage_incidents'));

drop policy if exists "incident_org_nodes_delete" on public.incident_org_nodes;
create policy "incident_org_nodes_delete"
  on public.incident_org_nodes for delete
  to authenticated
  using (public.has_capability('manage_incidents'));

-- Units on an incident (home apparatus or mutual aid)
create table if not exists public.incident_units (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  asset_id uuid references public.assets (id) on delete set null,
  label text not null,
  agency_name text,
  unit_type text,
  status text not null default 'staged',
  created_at timestamptz not null default now(),
  constraint incident_units_label_nonempty check (length(trim(label)) > 0),
  constraint incident_units_status_check check (
    status in ('staged', 'assigned', 'available', 'out_of_service')
  ),
  constraint incident_units_home_or_external check (
    asset_id is not null
    or (agency_name is not null and length(trim(agency_name)) > 0)
  )
);

create index if not exists incident_units_incident_id_idx
  on public.incident_units (incident_id);
create index if not exists incident_units_asset_id_idx
  on public.incident_units (asset_id);
create unique index if not exists incident_units_incident_asset_unique
  on public.incident_units (incident_id, asset_id)
  where asset_id is not null;

alter table public.incident_units enable row level security;

drop policy if exists "incident_units_select" on public.incident_units;
create policy "incident_units_select"
  on public.incident_units for select
  to authenticated
  using (public.has_capability('manage_incidents'));

drop policy if exists "incident_units_insert" on public.incident_units;
create policy "incident_units_insert"
  on public.incident_units for insert
  to authenticated
  with check (public.has_capability('manage_incidents'));

drop policy if exists "incident_units_update" on public.incident_units;
create policy "incident_units_update"
  on public.incident_units for update
  to authenticated
  using (public.has_capability('manage_incidents'))
  with check (public.has_capability('manage_incidents'));

drop policy if exists "incident_units_delete" on public.incident_units;
create policy "incident_units_delete"
  on public.incident_units for delete
  to authenticated
  using (public.has_capability('manage_incidents'));

-- Assignments (unit → org node + work period)
create table if not exists public.incident_assignments (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  unit_id uuid not null references public.incident_units (id) on delete cascade,
  org_node_id uuid not null references public.incident_org_nodes (id) on delete cascade,
  started_at timestamptz not null default now(),
  work_period_minutes integer not null default 20,
  ended_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  constraint incident_assignments_work_period_positive check (work_period_minutes > 0)
);

create index if not exists incident_assignments_incident_id_idx
  on public.incident_assignments (incident_id);
create index if not exists incident_assignments_unit_id_idx
  on public.incident_assignments (unit_id);
create index if not exists incident_assignments_org_node_id_idx
  on public.incident_assignments (org_node_id);
create unique index if not exists incident_assignments_active_unit_unique
  on public.incident_assignments (unit_id)
  where ended_at is null;

alter table public.incident_assignments enable row level security;

drop policy if exists "incident_assignments_select" on public.incident_assignments;
create policy "incident_assignments_select"
  on public.incident_assignments for select
  to authenticated
  using (public.has_capability('manage_incidents'));

drop policy if exists "incident_assignments_insert" on public.incident_assignments;
create policy "incident_assignments_insert"
  on public.incident_assignments for insert
  to authenticated
  with check (public.has_capability('manage_incidents'));

drop policy if exists "incident_assignments_update" on public.incident_assignments;
create policy "incident_assignments_update"
  on public.incident_assignments for update
  to authenticated
  using (public.has_capability('manage_incidents'))
  with check (public.has_capability('manage_incidents'));

drop policy if exists "incident_assignments_delete" on public.incident_assignments;
create policy "incident_assignments_delete"
  on public.incident_assignments for delete
  to authenticated
  using (public.has_capability('manage_incidents'));

-- Tactical map overlays
create table if not exists public.incident_map_overlays (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  -- Georeferenced corners (WGS84). When null, fit to current map viewport on first load.
  west double precision,
  south double precision,
  east double precision,
  north double precision,
  opacity double precision not null default 0.75,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint incident_map_overlays_path_nonempty check (length(trim(storage_path)) > 0),
  constraint incident_map_overlays_opacity_range check (opacity >= 0 and opacity <= 1)
);

create index if not exists incident_map_overlays_incident_id_idx
  on public.incident_map_overlays (incident_id);

alter table public.incident_map_overlays enable row level security;

drop policy if exists "incident_map_overlays_select" on public.incident_map_overlays;
create policy "incident_map_overlays_select"
  on public.incident_map_overlays for select
  to authenticated
  using (public.has_capability('manage_incidents'));

drop policy if exists "incident_map_overlays_insert" on public.incident_map_overlays;
create policy "incident_map_overlays_insert"
  on public.incident_map_overlays for insert
  to authenticated
  with check (public.has_capability('manage_incidents'));

drop policy if exists "incident_map_overlays_update" on public.incident_map_overlays;
create policy "incident_map_overlays_update"
  on public.incident_map_overlays for update
  to authenticated
  using (public.has_capability('manage_incidents'))
  with check (public.has_capability('manage_incidents'));

drop policy if exists "incident_map_overlays_delete" on public.incident_map_overlays;
create policy "incident_map_overlays_delete"
  on public.incident_map_overlays for delete
  to authenticated
  using (public.has_capability('manage_incidents'));

-- Unit map placements
create table if not exists public.incident_map_placements (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  unit_id uuid not null references public.incident_units (id) on delete cascade,
  lng double precision not null,
  lat double precision not null,
  overlay_x double precision,
  overlay_y double precision,
  updated_at timestamptz not null default now(),
  constraint incident_map_placements_overlay_x_range check (
    overlay_x is null or (overlay_x >= 0 and overlay_x <= 1)
  ),
  constraint incident_map_placements_overlay_y_range check (
    overlay_y is null or (overlay_y >= 0 and overlay_y <= 1)
  ),
  constraint incident_map_placements_unit_unique unique (unit_id)
);

create index if not exists incident_map_placements_incident_id_idx
  on public.incident_map_placements (incident_id);

create or replace function public.set_incident_map_placements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists incident_map_placements_updated_at on public.incident_map_placements;
create trigger incident_map_placements_updated_at
  before update on public.incident_map_placements
  for each row
  execute function public.set_incident_map_placements_updated_at();

alter table public.incident_map_placements enable row level security;

drop policy if exists "incident_map_placements_select" on public.incident_map_placements;
create policy "incident_map_placements_select"
  on public.incident_map_placements for select
  to authenticated
  using (public.has_capability('manage_incidents'));

drop policy if exists "incident_map_placements_insert" on public.incident_map_placements;
create policy "incident_map_placements_insert"
  on public.incident_map_placements for insert
  to authenticated
  with check (public.has_capability('manage_incidents'));

drop policy if exists "incident_map_placements_update" on public.incident_map_placements;
create policy "incident_map_placements_update"
  on public.incident_map_placements for update
  to authenticated
  using (public.has_capability('manage_incidents'))
  with check (public.has_capability('manage_incidents'));

drop policy if exists "incident_map_placements_delete" on public.incident_map_placements;
create policy "incident_map_placements_delete"
  on public.incident_map_placements for delete
  to authenticated
  using (public.has_capability('manage_incidents'));

-- Storage bucket for tactical overlays
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'incident-overlays',
  'incident-overlays',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "incident_overlays_storage_select" on storage.objects;
create policy "incident_overlays_storage_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'incident-overlays'
    and public.has_capability('manage_incidents')
  );

drop policy if exists "incident_overlays_storage_insert" on storage.objects;
create policy "incident_overlays_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'incident-overlays'
    and public.has_capability('manage_incidents')
  );

drop policy if exists "incident_overlays_storage_update" on storage.objects;
create policy "incident_overlays_storage_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'incident-overlays'
    and public.has_capability('manage_incidents')
  )
  with check (
    bucket_id = 'incident-overlays'
    and public.has_capability('manage_incidents')
  );

drop policy if exists "incident_overlays_storage_delete" on storage.objects;
create policy "incident_overlays_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'incident-overlays'
    and public.has_capability('manage_incidents')
  );

-- Realtime for command-post multi-user sync
alter table public.incident_assignments replica identity full;
alter table public.incident_map_placements replica identity full;
alter table public.incident_units replica identity full;
alter table public.incident_org_nodes replica identity full;
alter table public.incidents replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'incident_assignments'
  ) then
    alter publication supabase_realtime add table public.incident_assignments;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'incident_map_placements'
  ) then
    alter publication supabase_realtime add table public.incident_map_placements;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'incident_units'
  ) then
    alter publication supabase_realtime add table public.incident_units;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'incident_org_nodes'
  ) then
    alter publication supabase_realtime add table public.incident_org_nodes;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'incidents'
  ) then
    alter publication supabase_realtime add table public.incidents;
  end if;
end $$;
