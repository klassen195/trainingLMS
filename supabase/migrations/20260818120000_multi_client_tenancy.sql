-- Multi-client tenancy: clients table, client_id on tenant data, RLS helpers, seed Client 1.

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_code_unique unique (code),
  constraint clients_code_not_blank check (length(trim(code)) > 0),
  constraint clients_name_not_blank check (length(trim(name)) > 0),
  constraint clients_code_format check (code = upper(code) and code ~ '^[A-Z0-9_-]+$')
);

create index if not exists clients_is_active_idx on public.clients (is_active);

create or replace function public.set_clients_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.code = upper(btrim(new.code));
  return new;
end;
$$;

drop trigger if exists clients_updated_at on public.clients;
create trigger clients_updated_at
  before insert or update on public.clients
  for each row
  execute function public.set_clients_updated_at();

-- Deterministic Client 1 for existing department data
insert into public.clients (id, code, name, is_active)
values (
  'a0000000-0000-4000-8000-000000000001'::uuid,
  'CLIENT1',
  'Client 1',
  true
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Add client_id columns
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'profiles',
    'programs',
    'modules',
    'enrollments',
    'module_progress',
    'module_resources',
    'program_modules',
    'resource_progress',
    'module_enrollments',
    'question_bank_items',
    'question_bank_options',
    'quiz_settings',
    'quiz_attempts',
    'quiz_attempt_questions',
    'quiz_attempt_answers',
    'user_highlights',
    'checklist_items',
    'checklist_item_progress',
    'ems_qi_reviews',
    'program_tags',
    'shift_exchange_requests',
    'assets',
    'asset_inspections',
    'vehicle_check_template_items',
    'vehicle_checks',
    'vehicle_check_responses',
    'vehicle_check_templates',
    'asset_vehicle_check_templates',
    'apparatus_unit_assignments',
    'locations',
    'maintenance_requests',
    'equipment_categories',
    'equipment_subcategories',
    'personnel_certifications',
    'personnel_documents',
    'personnel_notes',
    'incidents',
    'incident_org_nodes',
    'incident_units',
    'incident_assignments',
    'incident_map_overlays',
    'incident_map_placements',
    'incident_map_polygons',
    'training_sessions',
    'training_session_attendees',
    'training_session_files',
    'training_categories',
    'training_session_days',
    'personnel_taskbooks',
    'personnel_taskbook_prerequisite_checks',
    'personnel_recognitions',
    'qualifications',
    'personnel_qualifications',
    'ems_levels',
    'personnel_ems_licenses',
    'ems_clearance_levels'
  ];
begin
  foreach t in array tables loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) and not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'client_id'
    ) then
      execute format(
        'alter table public.%I add column client_id uuid references public.clients (id)',
        t
      );
    end if;
  end loop;
end $$;

-- permission_level_capabilities: rebuild primary key to include client_id
alter table public.permission_level_capabilities
  add column if not exists client_id uuid references public.clients (id);

update public.permission_level_capabilities
set client_id = 'a0000000-0000-4000-8000-000000000001'::uuid
where client_id is null;

alter table public.permission_level_capabilities
  drop constraint if exists permission_level_capabilities_pkey;

alter table public.permission_level_capabilities
  alter column client_id set not null;

alter table public.permission_level_capabilities
  add primary key (client_id, role, capability);

-- Backfill all tenant tables to Client 1
do $$
declare
  t text;
  tables text[] := array[
    'profiles',
    'programs',
    'modules',
    'enrollments',
    'module_progress',
    'module_resources',
    'program_modules',
    'resource_progress',
    'module_enrollments',
    'question_bank_items',
    'question_bank_options',
    'quiz_settings',
    'quiz_attempts',
    'quiz_attempt_questions',
    'quiz_attempt_answers',
    'user_highlights',
    'checklist_items',
    'checklist_item_progress',
    'ems_qi_reviews',
    'program_tags',
    'shift_exchange_requests',
    'assets',
    'asset_inspections',
    'vehicle_check_template_items',
    'vehicle_checks',
    'vehicle_check_responses',
    'vehicle_check_templates',
    'asset_vehicle_check_templates',
    'apparatus_unit_assignments',
    'locations',
    'maintenance_requests',
    'equipment_categories',
    'equipment_subcategories',
    'personnel_certifications',
    'personnel_documents',
    'personnel_notes',
    'incidents',
    'incident_org_nodes',
    'incident_units',
    'incident_assignments',
    'incident_map_overlays',
    'incident_map_placements',
    'incident_map_polygons',
    'training_sessions',
    'training_session_attendees',
    'training_session_files',
    'training_categories',
    'training_session_days',
    'personnel_taskbooks',
    'personnel_taskbook_prerequisite_checks',
    'personnel_recognitions',
    'qualifications',
    'personnel_qualifications',
    'ems_levels',
    'personnel_ems_licenses',
    'ems_clearance_levels'
  ];
begin
  foreach t in array tables loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'client_id'
    ) then
      execute format(
        'update public.%I set client_id = %L::uuid where client_id is null',
        t,
        'a0000000-0000-4000-8000-000000000001'
      );
      execute format('alter table public.%I alter column client_id set not null', t);
      execute format(
        'create index if not exists %I on public.%I (client_id)',
        t || '_client_id_idx',
        t
      );
    end if;
  end loop;
end $$;

-- Per-client unique names for catalog tables
alter table public.locations drop constraint if exists locations_name_unique;
alter table public.locations
  add constraint locations_client_name_unique unique (client_id, name);

alter table public.equipment_categories drop constraint if exists equipment_categories_name_unique;
alter table public.equipment_categories
  add constraint equipment_categories_client_name_unique unique (client_id, name);

alter table public.training_categories drop constraint if exists training_categories_name_unique;
alter table public.training_categories
  add constraint training_categories_client_name_unique unique (client_id, name);

alter table public.qualifications drop constraint if exists qualifications_name_unique;
alter table public.qualifications
  add constraint qualifications_client_name_unique unique (client_id, name);

alter table public.ems_levels drop constraint if exists ems_levels_name_unique;
alter table public.ems_levels
  add constraint ems_levels_client_name_unique unique (client_id, name);

alter table public.ems_clearance_levels drop constraint if exists ems_clearance_levels_name_unique;
alter table public.ems_clearance_levels
  add constraint ems_clearance_levels_client_name_unique unique (client_id, name);

-- ---------------------------------------------------------------------------
-- Auth helpers (app_metadata only — never user_metadata)
-- ---------------------------------------------------------------------------
create or replace function public.current_client_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  begin
    cid := nullif(auth.jwt() -> 'app_metadata' ->> 'client_id', '')::uuid;
  exception when others then
    cid := null;
  end;
  if cid is not null then
    return cid;
  end if;
  select p.client_id into cid from public.profiles p where p.id = auth.uid();
  return cid;
end;
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'is_platform_admin')::boolean, false);
$$;

revoke all on function public.current_client_id() from public;
revoke all on function public.is_platform_admin() from public;
grant execute on function public.current_client_id() to authenticated, anon, service_role;
grant execute on function public.is_platform_admin() to authenticated, anon, service_role;

-- Auto-fill client_id on insert when omitted (JWT / profile session)
create or replace function public.set_row_client_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  if new.client_id is null then
    cid := public.current_client_id();
    if cid is null then
      raise exception 'client_id is required';
    end if;
    new.client_id := cid;
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
  tables text[] := array[
    'profiles',
    'programs',
    'modules',
    'enrollments',
    'module_progress',
    'module_resources',
    'program_modules',
    'resource_progress',
    'module_enrollments',
    'question_bank_items',
    'question_bank_options',
    'quiz_settings',
    'quiz_attempts',
    'quiz_attempt_questions',
    'quiz_attempt_answers',
    'user_highlights',
    'checklist_items',
    'checklist_item_progress',
    'ems_qi_reviews',
    'program_tags',
    'shift_exchange_requests',
    'assets',
    'asset_inspections',
    'vehicle_check_template_items',
    'vehicle_checks',
    'vehicle_check_responses',
    'vehicle_check_templates',
    'asset_vehicle_check_templates',
    'apparatus_unit_assignments',
    'locations',
    'maintenance_requests',
    'equipment_categories',
    'equipment_subcategories',
    'permission_level_capabilities',
    'personnel_certifications',
    'personnel_documents',
    'personnel_notes',
    'incidents',
    'incident_org_nodes',
    'incident_units',
    'incident_assignments',
    'incident_map_overlays',
    'incident_map_placements',
    'incident_map_polygons',
    'training_sessions',
    'training_session_attendees',
    'training_session_files',
    'training_categories',
    'training_session_days',
    'personnel_taskbooks',
    'personnel_taskbook_prerequisite_checks',
    'personnel_recognitions',
    'qualifications',
    'personnel_qualifications',
    'ems_levels',
    'personnel_ems_licenses',
    'ems_clearance_levels'
  ];
begin
  foreach t in array tables loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'client_id'
    ) then
      execute format('drop trigger if exists set_client_id_default on public.%I', t);
      execute format(
        'create trigger set_client_id_default before insert on public.%I for each row execute function public.set_row_client_id()',
        t
      );
    end if;
  end loop;
end $$;

-- Restrictive tenant isolation (AND with existing permissive policies)
do $$
declare
  t text;
  tables text[] := array[
    'profiles',
    'programs',
    'modules',
    'enrollments',
    'module_progress',
    'module_resources',
    'program_modules',
    'resource_progress',
    'module_enrollments',
    'question_bank_items',
    'question_bank_options',
    'quiz_settings',
    'quiz_attempts',
    'quiz_attempt_questions',
    'quiz_attempt_answers',
    'user_highlights',
    'checklist_items',
    'checklist_item_progress',
    'ems_qi_reviews',
    'program_tags',
    'assets',
    'asset_inspections',
    'vehicle_check_template_items',
    'vehicle_checks',
    'vehicle_check_responses',
    'vehicle_check_templates',
    'asset_vehicle_check_templates',
    'apparatus_unit_assignments',
    'locations',
    'maintenance_requests',
    'equipment_categories',
    'equipment_subcategories',
    'permission_level_capabilities',
    'personnel_certifications',
    'personnel_documents',
    'personnel_notes',
    'incidents',
    'incident_org_nodes',
    'incident_units',
    'incident_assignments',
    'incident_map_overlays',
    'incident_map_placements',
    'incident_map_polygons',
    'training_sessions',
    'training_session_attendees',
    'training_session_files',
    'training_categories',
    'training_session_days',
    'personnel_taskbooks',
    'personnel_taskbook_prerequisite_checks',
    'personnel_recognitions',
    'qualifications',
    'personnel_qualifications',
    'ems_levels',
    'personnel_ems_licenses',
    'ems_clearance_levels'
  ];
begin
  foreach t in array tables loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'client_id'
    ) then
      execute format('drop policy if exists tenant_isolation on public.%I', t);
      execute format(
        'create policy tenant_isolation on public.%I as restrictive for all to authenticated using (client_id = public.current_client_id()) with check (client_id = public.current_client_id())',
        t
      );
    end if;
  end loop;
end $$;

-- Shift exchange: remove open cross-tenant access; authenticated siloed; anon via app service role
drop policy if exists "shift_exchange_select_open" on public.shift_exchange_requests;
drop policy if exists "shift_exchange_insert_open" on public.shift_exchange_requests;
drop policy if exists "shift_exchange_resolve_open" on public.shift_exchange_requests;
drop policy if exists "shift_exchange_update_open" on public.shift_exchange_requests;
drop policy if exists tenant_isolation on public.shift_exchange_requests;

create policy "shift_exchange_select_authenticated"
  on public.shift_exchange_requests for select
  to authenticated
  using (client_id = public.current_client_id());

create policy "shift_exchange_insert_authenticated"
  on public.shift_exchange_requests for insert
  to authenticated
  with check (client_id = public.current_client_id());

create policy "shift_exchange_update_authenticated"
  on public.shift_exchange_requests for update
  to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

create policy tenant_isolation
  on public.shift_exchange_requests
  as restrictive
  for all
  to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

-- Clients table RLS
alter table public.clients enable row level security;

drop policy if exists "clients_select_own_or_platform" on public.clients;
create policy "clients_select_own_or_platform"
  on public.clients for select
  to authenticated
  using (id = public.current_client_id() or public.is_platform_admin());

drop policy if exists "clients_mutate_platform_admin" on public.clients;
create policy "clients_mutate_platform_admin"
  on public.clients for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Capability checks scoped to the user's client
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
            and c.role = p.role
            and c.capability = p_capability
            and c.enabled = true
        )
      )
  );
$$;

-- New auth users inherit client_id from app_metadata
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
begin
  if meta_first is not null or meta_last is not null then
    composed := nullif(btrim(concat_ws(' ', meta_first, meta_last)), '');
  else
    composed := coalesce(meta_display, split_part(new.email, '@', 1));
  end if;

  if client_uuid is null then
    raise exception 'New users must be invited with a client_id in app_metadata';
  end if;

  insert into public.profiles (id, display_name, first_name, last_name, email, client_id)
  values (new.id, composed, meta_first, meta_last, new.email, client_uuid);
  return new;
end;
$$;

-- Seed default permission matrix for a client (used when creating new clients)
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

  insert into public.permission_level_capabilities (client_id, role, capability, enabled)
  values
    (p_client_id, 'recruit', 'browse_program_catalog', false),
    (p_client_id, 'recruit', 'self_enroll', false),
    (p_client_id, 'recruit', 'author_training', false),
    (p_client_id, 'recruit', 'ems_qi', false),
    (p_client_id, 'recruit', 'view_apparatus', false),
    (p_client_id, 'recruit', 'view_all_ppe', false),
    (p_client_id, 'recruit', 'submit_vehicle_checks', true),
    (p_client_id, 'recruit', 'submit_maintenance', true),
    (p_client_id, 'recruit', 'manage_assets', false),
    (p_client_id, 'recruit', 'manage_locations', false),
    (p_client_id, 'recruit', 'manage_vehicle_check_templates', false),
    (p_client_id, 'recruit', 'manage_quiz_banks', false),
    (p_client_id, 'recruit', 'resolve_maintenance', false),
    (p_client_id, 'recruit', 'manage_users', false),
    (p_client_id, 'firefighter', 'browse_program_catalog', true),
    (p_client_id, 'firefighter', 'self_enroll', true),
    (p_client_id, 'firefighter', 'author_training', false),
    (p_client_id, 'firefighter', 'ems_qi', false),
    (p_client_id, 'firefighter', 'view_apparatus', true),
    (p_client_id, 'firefighter', 'view_all_ppe', false),
    (p_client_id, 'firefighter', 'submit_vehicle_checks', true),
    (p_client_id, 'firefighter', 'submit_maintenance', true),
    (p_client_id, 'firefighter', 'manage_assets', false),
    (p_client_id, 'firefighter', 'manage_locations', false),
    (p_client_id, 'firefighter', 'manage_vehicle_check_templates', false),
    (p_client_id, 'firefighter', 'manage_quiz_banks', false),
    (p_client_id, 'firefighter', 'resolve_maintenance', false),
    (p_client_id, 'firefighter', 'manage_users', false),
    (p_client_id, 'captain', 'browse_program_catalog', true),
    (p_client_id, 'captain', 'self_enroll', true),
    (p_client_id, 'captain', 'author_training', true),
    (p_client_id, 'captain', 'ems_qi', true),
    (p_client_id, 'captain', 'view_apparatus', true),
    (p_client_id, 'captain', 'view_all_ppe', false),
    (p_client_id, 'captain', 'submit_vehicle_checks', true),
    (p_client_id, 'captain', 'submit_maintenance', true),
    (p_client_id, 'captain', 'manage_assets', false),
    (p_client_id, 'captain', 'manage_locations', false),
    (p_client_id, 'captain', 'manage_vehicle_check_templates', false),
    (p_client_id, 'captain', 'manage_quiz_banks', false),
    (p_client_id, 'captain', 'resolve_maintenance', false),
    (p_client_id, 'captain', 'manage_users', false)
  on conflict (client_id, role, capability) do nothing;
end;
$$;

revoke all on function public.seed_client_permission_defaults(uuid) from public;
grant execute on function public.seed_client_permission_defaults(uuid) to service_role, authenticated;

-- Lookup active client by code (login)
create or replace function public.resolve_client_id_by_code(p_code text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.clients c
  where c.code = upper(btrim(p_code))
    and c.is_active = true
  limit 1;
$$;

revoke all on function public.resolve_client_id_by_code(text) from public;
grant execute on function public.resolve_client_id_by_code(text) to anon, authenticated, service_role;

-- Backfill existing Auth users' app_metadata.client_id to Client 1
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('client_id', 'a0000000-0000-4000-8000-000000000001')
where coalesce(raw_app_meta_data ->> 'client_id', '') = '';
