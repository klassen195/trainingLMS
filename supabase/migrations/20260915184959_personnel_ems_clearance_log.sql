-- EMS clearance history on personnel files, plus a permission to edit that log.

create table if not exists public.personnel_ems_clearance_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  clearance_level_id uuid references public.ems_clearance_levels (id) on delete set null,
  clearance_level_name text not null,
  previous_clearance_level_name text,
  granted_on date not null default (timezone('utc', now()))::date,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personnel_ems_clearance_log_name_nonempty check (length(trim(clearance_level_name)) > 0)
);

create index if not exists personnel_ems_clearance_log_profile_granted_idx
  on public.personnel_ems_clearance_log (profile_id, granted_on desc, created_at desc);

drop trigger if exists set_client_id_default on public.personnel_ems_clearance_log;
create trigger set_client_id_default
  before insert on public.personnel_ems_clearance_log
  for each row
  execute function public.set_row_client_id();

alter table public.personnel_ems_clearance_log enable row level security;

drop policy if exists tenant_isolation on public.personnel_ems_clearance_log;
create policy tenant_isolation on public.personnel_ems_clearance_log
  as restrictive for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

drop policy if exists "personnel_ems_clearance_log_select" on public.personnel_ems_clearance_log;
create policy "personnel_ems_clearance_log_select"
  on public.personnel_ems_clearance_log for select
  to authenticated
  using (
    profile_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = personnel_ems_clearance_log.profile_id
        and p.supervisor_id = auth.uid()
    )
    or public.is_battalion_chief_of(personnel_ems_clearance_log.profile_id)
  );

drop policy if exists "personnel_ems_clearance_log_write" on public.personnel_ems_clearance_log;
create policy "personnel_ems_clearance_log_write"
  on public.personnel_ems_clearance_log for all
  to authenticated
  using (public.has_capability('edit_ems_clearance_log'))
  with check (public.has_capability('edit_ems_clearance_log'));

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
      'edit_ems_clearance_log'
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
      'edit_ems_clearance_log'
    )
  );

insert into public.permission_level_capabilities (client_id, permission_level_id, capability, enabled)
select pl.client_id, pl.id, 'edit_ems_clearance_log', false
from public.permission_levels pl
on conflict (permission_level_id, capability) do nothing;

insert into public.capability_display_order (client_id, capability, sort_order, group_name, label)
select c.id, 'edit_ems_clearance_log', 28, 'Administration', 'Edit EMS clearance log'
from public.clients c
on conflict (client_id, capability) do update
set group_name = excluded.group_name, label = excluded.label;

create or replace function public.permission_levels_seed_capabilities()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.permission_level_capabilities (client_id, permission_level_id, capability, enabled)
  select new.client_id, new.id, cap, cap in (
    'access_shift_exchange', 'access_shift_plan', 'access_professional_services',
    'access_programs', 'access_assets', 'access_personnel', 'access_reports'
  )
  from unnest(array[
    'access_shift_exchange', 'access_shift_plan', 'access_programs', 'access_assets',
    'access_personnel', 'browse_program_catalog', 'self_enroll', 'author_training',
    'ems_qi', 'document_training', 'delete_training_reports', 'manage_upcoming_training',
    'view_apparatus', 'view_all_ppe', 'submit_vehicle_checks', 'submit_maintenance',
    'manage_assets', 'manage_locations', 'manage_vehicle_check_templates', 'manage_quiz_banks',
    'resolve_maintenance', 'manage_users', 'manage_incidents', 'view_fleet',
    'approval_tracker', 'access_professional_services', 'access_reports',
    'edit_ems_clearance_log'
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
    ('browse_program_catalog', 8, 'Training', 'Browse program catalog'),
    ('self_enroll', 9, 'Training', 'Self-enroll in training'),
    ('author_training', 10, 'Training', 'Author training'),
    ('ems_qi', 11, 'Training', 'EMS QI'),
    ('document_training', 12, 'Training', 'Document training'),
    ('delete_training_reports', 13, 'Training', 'Delete training reports'),
    ('manage_upcoming_training', 14, 'Training', 'Manage upcoming training'),
    ('approval_tracker', 15, 'Training', 'Policy Tracker'),
    ('view_apparatus', 16, 'Assets & operations', 'View apparatus inventory'),
    ('view_fleet', 17, 'Assets & operations', 'View fleet shop'),
    ('view_all_ppe', 18, 'Assets & operations', 'View all equipment'),
    ('submit_vehicle_checks', 19, 'Assets & operations', 'Submit vehicle checks'),
    ('submit_maintenance', 20, 'Assets & operations', 'Submit maintenance requests'),
    ('manage_incidents', 21, 'Assets & operations', 'Manage incidents'),
    ('manage_assets', 22, 'Administration', 'Manage assets'),
    ('manage_locations', 23, 'Administration', 'Manage locations'),
    ('manage_vehicle_check_templates', 24, 'Administration', 'Manage check templates'),
    ('manage_quiz_banks', 25, 'Administration', 'Manage quiz banks'),
    ('resolve_maintenance', 26, 'Administration', 'Resolve maintenance'),
    ('manage_users', 27, 'Administration', 'Manage users'),
    ('edit_ems_clearance_log', 28, 'Administration', 'Edit EMS clearance log')
  ) as item(capability, sort_order, group_name, label)
  on conflict (client_id, capability) do nothing;

  return new;
end;
$$;
