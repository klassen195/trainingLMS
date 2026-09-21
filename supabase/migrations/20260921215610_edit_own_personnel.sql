-- Allow members with edit_own_personnel to maintain their own personnel file.
-- Language verification stays on verify_personnel_languages.

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
      'edit_own_personnel'
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
      'edit_own_personnel'
    )
  );

insert into public.permission_level_capabilities (client_id, permission_level_id, capability, enabled)
select pl.client_id, pl.id, 'edit_own_personnel', false
from public.permission_levels pl
on conflict (permission_level_id, capability) do nothing;

insert into public.capability_display_order (client_id, capability, sort_order, group_name, label)
select c.id, 'edit_own_personnel', 31, 'Administration', 'Edit own personnel file'
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
    'edit_ems_clearance_log', 'access_pdip', 'verify_personnel_languages', 'edit_own_personnel'
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
    ('edit_ems_clearance_log', 29, 'Administration', 'Edit EMS clearance log'),
    ('verify_personnel_languages', 30, 'Administration', 'Verify personnel languages'),
    ('edit_own_personnel', 31, 'Administration', 'Edit own personnel file')
  ) as item(capability, sort_order, group_name, label)
  on conflict (client_id, capability) do nothing;

  return new;
end;
$$;

-- Languages: self with edit_own_personnel can add/edit/delete; verify stays separate.
drop policy if exists "personnel_languages_insert_admin" on public.personnel_languages;
create policy "personnel_languages_insert"
  on public.personnel_languages for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      profile_id = auth.uid()
      and public.has_capability('edit_own_personnel')
    )
  );

drop policy if exists "personnel_languages_update" on public.personnel_languages;
create policy "personnel_languages_update"
  on public.personnel_languages for update
  to authenticated
  using (
    public.is_admin()
    or public.has_capability('verify_personnel_languages')
    or (
      profile_id = auth.uid()
      and public.has_capability('edit_own_personnel')
    )
  )
  with check (
    public.is_admin()
    or public.has_capability('verify_personnel_languages')
    or (
      profile_id = auth.uid()
      and public.has_capability('edit_own_personnel')
    )
  );

drop policy if exists "personnel_languages_delete_admin" on public.personnel_languages;
create policy "personnel_languages_delete"
  on public.personnel_languages for delete
  to authenticated
  using (
    public.is_admin()
    or (
      profile_id = auth.uid()
      and public.has_capability('edit_own_personnel')
    )
  );
