-- Rename the rope inventory capability labels to Tech Rescue.

update public.capability_display_order
set label = 'View tech rescue inventory'
where capability = 'view_rope_inventory';

update public.capability_display_order
set label = 'Manage tech rescue inventory'
where capability = 'manage_rope_inventory';

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
    ('view_rope_inventory', 32, 'Assets & operations', 'View tech rescue inventory'),
    ('manage_rope_inventory', 33, 'Assets & operations', 'Manage tech rescue inventory'),
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
