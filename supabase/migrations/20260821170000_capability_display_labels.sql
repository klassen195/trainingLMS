-- Allow admins to rename capability display labels per department.

alter table public.capability_display_order
  add column if not exists label text;

update public.capability_display_order
set label = case capability
  when 'access_shift_exchange' then 'Shift Exchange'
  when 'access_programs' then 'Programs'
  when 'access_assets' then 'Assets'
  when 'access_personnel' then 'Personnel'
  when 'browse_program_catalog' then 'Browse program catalog'
  when 'self_enroll' then 'Self-enroll in training'
  when 'author_training' then 'Author training'
  when 'ems_qi' then 'EMS QI'
  when 'document_training' then 'Document training'
  when 'delete_training_reports' then 'Delete training reports'
  when 'approval_tracker' then 'Policy Tracker'
  when 'view_apparatus' then 'View apparatus inventory'
  when 'view_fleet' then 'View fleet shop'
  when 'view_all_ppe' then 'View all equipment'
  when 'submit_vehicle_checks' then 'Submit vehicle checks'
  when 'submit_maintenance' then 'Submit maintenance requests'
  when 'manage_assets' then 'Manage assets'
  when 'manage_locations' then 'Manage locations'
  when 'manage_vehicle_check_templates' then 'Manage check templates'
  when 'manage_quiz_banks' then 'Manage quiz banks'
  when 'resolve_maintenance' then 'Resolve maintenance'
  when 'manage_users' then 'Manage users'
  when 'manage_incidents' then 'Manage incidents'
  else initcap(replace(capability, '_', ' '))
end
where label is null or length(trim(label)) = 0;

alter table public.capability_display_order
  alter column label set default '';

update public.capability_display_order
set label = trim(label)
where label is distinct from trim(label);

alter table public.capability_display_order
  drop constraint if exists capability_display_order_label_check;

alter table public.capability_display_order
  add constraint capability_display_order_label_check check (
    length(trim(label)) > 0
  );

alter table public.capability_display_order
  alter column label set not null;

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
    'access_programs',
    'access_assets',
    'access_personnel'
  )
  from unnest(array[
    'access_shift_exchange',
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
      ('access_programs', 2, 'Modules', 'Programs'),
      ('access_assets', 3, 'Modules', 'Assets'),
      ('access_personnel', 4, 'Modules', 'Personnel'),
      ('browse_program_catalog', 5, 'Training', 'Browse program catalog'),
      ('self_enroll', 6, 'Training', 'Self-enroll in training'),
      ('author_training', 7, 'Training', 'Author training'),
      ('ems_qi', 8, 'Training', 'EMS QI'),
      ('document_training', 9, 'Training', 'Document training'),
      ('delete_training_reports', 10, 'Training', 'Delete training reports'),
      ('approval_tracker', 11, 'Training', 'Policy Tracker'),
      ('view_apparatus', 12, 'Assets & operations', 'View apparatus inventory'),
      ('view_fleet', 13, 'Assets & operations', 'View fleet shop'),
      ('view_all_ppe', 14, 'Assets & operations', 'View all equipment'),
      ('submit_vehicle_checks', 15, 'Assets & operations', 'Submit vehicle checks'),
      ('submit_maintenance', 16, 'Assets & operations', 'Submit maintenance requests'),
      ('manage_incidents', 17, 'Assets & operations', 'Manage incidents'),
      ('manage_assets', 18, 'Administration', 'Manage assets'),
      ('manage_locations', 19, 'Administration', 'Manage locations'),
      ('manage_vehicle_check_templates', 20, 'Administration', 'Manage check templates'),
      ('manage_quiz_banks', 21, 'Administration', 'Manage quiz banks'),
      ('resolve_maintenance', 22, 'Administration', 'Resolve maintenance'),
      ('manage_users', 23, 'Administration', 'Manage users')
  ) as item(capability, sort_order, group_name, label)
  on conflict (client_id, capability) do nothing;

  return new;
end;
$$;
