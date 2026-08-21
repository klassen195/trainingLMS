-- Persist capability groups for cross-group drag, and add module-access capabilities.

alter table public.capability_display_order
  add column if not exists group_name text;

update public.capability_display_order
set group_name = case capability
  when 'browse_program_catalog' then 'Training'
  when 'self_enroll' then 'Training'
  when 'author_training' then 'Training'
  when 'ems_qi' then 'Training'
  when 'document_training' then 'Training'
  when 'delete_training_reports' then 'Training'
  when 'approval_tracker' then 'Training'
  when 'view_apparatus' then 'Assets & operations'
  when 'view_fleet' then 'Assets & operations'
  when 'view_all_ppe' then 'Assets & operations'
  when 'submit_vehicle_checks' then 'Assets & operations'
  when 'submit_maintenance' then 'Assets & operations'
  when 'manage_incidents' then 'Assets & operations'
  when 'manage_assets' then 'Administration'
  when 'manage_locations' then 'Administration'
  when 'manage_vehicle_check_templates' then 'Administration'
  when 'manage_quiz_banks' then 'Administration'
  when 'resolve_maintenance' then 'Administration'
  when 'manage_users' then 'Administration'
  else 'Training'
end
where group_name is null;

alter table public.capability_display_order
  alter column group_name set default 'Training';

alter table public.capability_display_order
  alter column group_name set not null;

alter table public.capability_display_order
  drop constraint if exists capability_display_order_group_name_check;

alter table public.capability_display_order
  add constraint capability_display_order_group_name_check check (
    length(trim(group_name)) > 0
  );

alter table public.permission_level_capabilities
  drop constraint if exists permission_level_capabilities_capability_check;

alter table public.permission_level_capabilities
  add constraint permission_level_capabilities_capability_check check (
    capability in (
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
    )
  );

alter table public.capability_display_order
  drop constraint if exists capability_display_order_capability_check;

alter table public.capability_display_order
  add constraint capability_display_order_capability_check check (
    capability in (
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
    )
  );

-- Seed module-access capabilities for every permission level (enabled by default
-- so existing departments keep current nav visibility).
insert into public.permission_level_capabilities (client_id, permission_level_id, capability, enabled)
select pl.client_id, pl.id, cap, true
from public.permission_levels pl
cross join (
  values
    ('access_shift_exchange'),
    ('access_programs'),
    ('access_assets'),
    ('access_personnel')
) as caps(cap)
on conflict (permission_level_id, capability) do nothing;

-- Display order rows for module capabilities (Modules group).
insert into public.capability_display_order (client_id, capability, sort_order, group_name)
select
  c.id,
  cap.capability,
  cap.sort_order,
  'Modules'
from public.clients c
cross join (
  values
    ('access_shift_exchange', 1),
    ('access_programs', 2),
    ('access_assets', 3),
    ('access_personnel', 4)
) as cap(capability, sort_order)
on conflict (client_id, capability) do update
set group_name = excluded.group_name;

-- Normalize sort order: Modules first, then remaining by prior sort_order.
with ranked as (
  select
    client_id,
    capability,
    row_number() over (
      partition by client_id
      order by
        case when group_name = 'Modules' then 0 else 1 end,
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

  insert into public.capability_display_order (client_id, capability, sort_order, group_name)
  select new.client_id, item.capability, item.sort_order, item.group_name
  from (
    values
      ('access_shift_exchange', 1, 'Modules'),
      ('access_programs', 2, 'Modules'),
      ('access_assets', 3, 'Modules'),
      ('access_personnel', 4, 'Modules'),
      ('browse_program_catalog', 5, 'Training'),
      ('self_enroll', 6, 'Training'),
      ('author_training', 7, 'Training'),
      ('ems_qi', 8, 'Training'),
      ('document_training', 9, 'Training'),
      ('delete_training_reports', 10, 'Training'),
      ('approval_tracker', 11, 'Training'),
      ('view_apparatus', 12, 'Assets & operations'),
      ('view_fleet', 13, 'Assets & operations'),
      ('view_all_ppe', 14, 'Assets & operations'),
      ('submit_vehicle_checks', 15, 'Assets & operations'),
      ('submit_maintenance', 16, 'Assets & operations'),
      ('manage_incidents', 17, 'Assets & operations'),
      ('manage_assets', 18, 'Administration'),
      ('manage_locations', 19, 'Administration'),
      ('manage_vehicle_check_templates', 20, 'Administration'),
      ('manage_quiz_banks', 21, 'Administration'),
      ('resolve_maintenance', 22, 'Administration'),
      ('manage_users', 23, 'Administration')
  ) as item(capability, sort_order, group_name)
  on conflict (client_id, capability) do nothing;

  return new;
end;
$$;
