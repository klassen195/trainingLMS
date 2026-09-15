-- Department logo on clients + access_reports capability / nav module.

-- ---------------------------------------------------------------------------
-- Client logo columns
-- ---------------------------------------------------------------------------

alter table public.clients
  add column if not exists logo_storage_path text,
  add column if not exists logo_file_name text,
  add column if not exists logo_mime_type text,
  add column if not exists logo_updated_at timestamptz;

alter table public.clients
  drop constraint if exists clients_logo_fields_consistent;

alter table public.clients
  add constraint clients_logo_fields_consistent check (
    (
      logo_storage_path is null
      and logo_file_name is null
      and logo_mime_type is null
    )
    or (
      logo_storage_path is not null
      and length(trim(logo_storage_path)) > 0
      and logo_file_name is not null
      and length(trim(logo_file_name)) > 0
      and logo_mime_type is not null
      and length(trim(logo_mime_type)) > 0
    )
  );

-- Department admins may update logo fields on their own client only.
drop policy if exists "clients_update_logo_department_admin" on public.clients;
create policy "clients_update_logo_department_admin"
  on public.clients for update
  to authenticated
  using (id = public.current_client_id() and public.is_admin())
  with check (id = public.current_client_id() and public.is_admin());

create or replace function public.clients_restrict_non_platform_core_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_platform_admin() then
    return new;
  end if;

  if new.code is distinct from old.code
     or new.name is distinct from old.name
     or new.is_active is distinct from old.is_active
  then
    raise exception 'Only platform admins can change client identity fields';
  end if;

  return new;
end;
$$;

drop trigger if exists clients_restrict_non_platform_core_fields on public.clients;
create trigger clients_restrict_non_platform_core_fields
  before update on public.clients
  for each row
  execute function public.clients_restrict_non_platform_core_fields();

-- ---------------------------------------------------------------------------
-- Storage: client-logos
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-logos',
  'client-logos',
  false,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path layout: {client_id}/logo/{filename}
drop policy if exists "client_logos_storage_select" on storage.objects;
create policy "client_logos_storage_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'client-logos'
    and (
      public.is_platform_admin()
      or split_part(name, '/', 1) = public.current_client_id()::text
    )
  );

drop policy if exists "client_logos_storage_insert" on storage.objects;
create policy "client_logos_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'client-logos'
    and public.is_admin()
    and split_part(name, '/', 1) = public.current_client_id()::text
  );

drop policy if exists "client_logos_storage_update" on storage.objects;
create policy "client_logos_storage_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'client-logos'
    and public.is_admin()
    and split_part(name, '/', 1) = public.current_client_id()::text
  )
  with check (
    bucket_id = 'client-logos'
    and public.is_admin()
    and split_part(name, '/', 1) = public.current_client_id()::text
  );

drop policy if exists "client_logos_storage_delete" on storage.objects;
create policy "client_logos_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'client-logos'
    and public.is_admin()
    and split_part(name, '/', 1) = public.current_client_id()::text
  );

-- ---------------------------------------------------------------------------
-- access_reports capability
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
      'access_reports'
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
      'approval_tracker',
      'access_professional_services',
      'access_reports'
    )
  );

insert into public.permission_level_capabilities (client_id, permission_level_id, capability, enabled)
select pl.client_id, pl.id, 'access_reports', true
from public.permission_levels pl
on conflict (permission_level_id, capability) do nothing;

insert into public.capability_display_order (client_id, capability, sort_order, group_name, label)
select c.id, 'access_reports', 7, 'Modules', 'Reports'
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
        case when group_name = 'Modules' then 0
             when group_name = 'Training' then 1
             when group_name = 'Assets & operations' then 2
             when group_name = 'Administration' then 3
             else 4
        end,
        case capability
          when 'access_shift_exchange' then 1
          when 'access_shift_plan' then 2
          when 'access_professional_services' then 3
          when 'access_programs' then 4
          when 'access_assets' then 5
          when 'access_personnel' then 6
          when 'access_reports' then 7
          else 50
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
    'access_professional_services',
    'access_programs',
    'access_assets',
    'access_personnel',
    'access_reports'
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
    'approval_tracker',
    'access_professional_services',
    'access_reports'
  ]::text[]) as cap
  on conflict (permission_level_id, capability) do nothing;

  insert into public.capability_display_order (client_id, capability, sort_order, group_name, label)
  select new.client_id, item.capability, item.sort_order, item.group_name, item.label
  from (
    values
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
      ('approval_tracker', 14, 'Training', 'Policy Tracker'),
      ('view_apparatus', 15, 'Assets & operations', 'View apparatus inventory'),
      ('view_fleet', 16, 'Assets & operations', 'View fleet shop'),
      ('view_all_ppe', 17, 'Assets & operations', 'View all equipment'),
      ('submit_vehicle_checks', 18, 'Assets & operations', 'Submit vehicle checks'),
      ('submit_maintenance', 19, 'Assets & operations', 'Submit maintenance requests'),
      ('manage_incidents', 20, 'Assets & operations', 'Manage incidents'),
      ('manage_assets', 21, 'Administration', 'Manage assets'),
      ('manage_locations', 22, 'Administration', 'Manage locations'),
      ('manage_vehicle_check_templates', 23, 'Administration', 'Manage check templates'),
      ('manage_quiz_banks', 24, 'Administration', 'Manage quiz banks'),
      ('resolve_maintenance', 25, 'Administration', 'Resolve maintenance'),
      ('manage_users', 26, 'Administration', 'Manage users')
  ) as item(capability, sort_order, group_name, label)
  on conflict (client_id, capability) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Client modules + platform catalog
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
      'access_reports'
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
      'access_reports'
    )
  );

insert into public.platform_module_catalog (module_key, sort_order)
values ('access_reports', 12)
on conflict (module_key) do nothing;

insert into public.client_modules (client_id, module_key, enabled, sort_order)
select c.id, 'access_reports', true, 12
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
    true,
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
    (p_client_id, 'access_reports', true, 12)
  on conflict (client_id, module_key) do nothing;
end;
$$;
