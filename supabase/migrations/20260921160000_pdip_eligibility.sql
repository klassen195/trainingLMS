-- PDIP eligibility on certifications/qualifications + optional access_pdip client module.

alter table public.personnel_certifications
  add column if not exists pdip_eligible boolean not null default false;

alter table public.qualifications
  add column if not exists pdip_eligible boolean not null default false;

-- ---------------------------------------------------------------------------
-- access_pdip capability
-- ---------------------------------------------------------------------------

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
      'access_pdip'
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
      'access_pdip'
    )
  );

-- Capability on for all levels; client module stays off until platform enables it.
insert into public.permission_level_capabilities (client_id, permission_level_id, capability, enabled)
select pl.client_id, pl.id, 'access_pdip', true
from public.permission_levels pl
on conflict (permission_level_id, capability) do nothing;

insert into public.capability_display_order (client_id, capability, sort_order, group_name, label)
select c.id, 'access_pdip', 8, 'Modules', 'PDIP'
from public.clients c
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
    'edit_ems_clearance_log', 'access_pdip'
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
    ('manage_assets', 23, 'Administration', 'Manage assets'),
    ('manage_locations', 24, 'Administration', 'Manage locations'),
    ('manage_vehicle_check_templates', 25, 'Administration', 'Manage check templates'),
    ('manage_quiz_banks', 26, 'Administration', 'Manage quiz banks'),
    ('resolve_maintenance', 27, 'Administration', 'Resolve maintenance'),
    ('manage_users', 28, 'Administration', 'Manage users'),
    ('edit_ems_clearance_log', 29, 'Administration', 'Edit EMS clearance log')
  ) as item(capability, sort_order, group_name, label)
  on conflict (client_id, capability) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Client modules + platform catalog (default OFF)
-- ---------------------------------------------------------------------------

alter table public.client_modules
  drop constraint if exists client_modules_module_key_check;

alter table public.client_modules
  add constraint client_modules_module_key_check check (
    module_key in (
      'access_shift_exchange',
      'access_shift_plan',
      'access_professional_services',
      'access_programs',
      'access_assets',
      'view_fleet',
      'manage_incidents',
      'access_personnel',
      'document_training',
      'approval_tracker',
      'author_training',
      'access_reports',
      'access_pdip'
    )
  );

alter table public.platform_module_catalog
  drop constraint if exists platform_module_catalog_module_key_check;

alter table public.platform_module_catalog
  add constraint platform_module_catalog_module_key_check check (
    module_key in (
      'access_shift_exchange',
      'access_shift_plan',
      'access_professional_services',
      'access_programs',
      'access_assets',
      'view_fleet',
      'manage_incidents',
      'access_personnel',
      'document_training',
      'approval_tracker',
      'author_training',
      'access_reports',
      'access_pdip'
    )
  );

insert into public.platform_module_catalog (module_key, sort_order)
values ('access_pdip', 13)
on conflict (module_key) do nothing;

insert into public.client_modules (client_id, module_key, enabled, sort_order)
select c.id, 'access_pdip', false, 13
from public.clients c
on conflict (client_id, module_key) do nothing;

create or replace function public.seed_client_modules(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' and not public.is_platform_admin() then
    raise exception 'Only platform admins can seed client modules';
  end if;

  insert into public.client_modules (client_id, module_key, enabled, sort_order)
  select
    p_client_id,
    c.module_key,
    case when c.module_key = 'access_pdip' then false else true end,
    c.sort_order
  from public.platform_module_catalog c
  order by c.sort_order, c.module_key
  on conflict (client_id, module_key) do nothing;

  insert into public.client_modules (client_id, module_key, enabled, sort_order)
  values
    (p_client_id, 'access_shift_exchange', true, 1),
    (p_client_id, 'access_shift_plan', true, 2),
    (p_client_id, 'access_professional_services', true, 3),
    (p_client_id, 'access_programs', true, 4),
    (p_client_id, 'access_assets', true, 5),
    (p_client_id, 'view_fleet', true, 6),
    (p_client_id, 'manage_incidents', true, 7),
    (p_client_id, 'access_personnel', true, 8),
    (p_client_id, 'document_training', true, 9),
    (p_client_id, 'approval_tracker', true, 10),
    (p_client_id, 'author_training', true, 11),
    (p_client_id, 'access_reports', true, 12),
    (p_client_id, 'access_pdip', false, 13)
  on conflict (client_id, module_key) do nothing;
end;
$$;
