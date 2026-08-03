-- Configurable capabilities per permission level (Recruit / Firefighter / Captain).
-- System admins (profiles.is_admin) always have every capability via has_capability().

create table if not exists public.permission_level_capabilities (
  role public.user_role not null,
  capability text not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (role, capability),
  constraint permission_level_capabilities_capability_check check (
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
      'manage_users'
    )
  )
);

create or replace function public.set_permission_level_capabilities_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists permission_level_capabilities_updated_at on public.permission_level_capabilities;
create trigger permission_level_capabilities_updated_at
  before update on public.permission_level_capabilities
  for each row
  execute function public.set_permission_level_capabilities_updated_at();

-- Seed defaults matching current product behavior
insert into public.permission_level_capabilities (role, capability, enabled)
values
  -- Recruit
  ('recruit', 'browse_program_catalog', false),
  ('recruit', 'self_enroll', false),
  ('recruit', 'author_training', false),
  ('recruit', 'ems_qi', false),
  ('recruit', 'view_apparatus', false),
  ('recruit', 'view_all_ppe', false),
  ('recruit', 'submit_vehicle_checks', true),
  ('recruit', 'submit_maintenance', true),
  ('recruit', 'manage_assets', false),
  ('recruit', 'manage_locations', false),
  ('recruit', 'manage_vehicle_check_templates', false),
  ('recruit', 'manage_quiz_banks', false),
  ('recruit', 'resolve_maintenance', false),
  ('recruit', 'manage_users', false),
  -- Firefighter
  ('firefighter', 'browse_program_catalog', true),
  ('firefighter', 'self_enroll', true),
  ('firefighter', 'author_training', false),
  ('firefighter', 'ems_qi', false),
  ('firefighter', 'view_apparatus', true),
  ('firefighter', 'view_all_ppe', false),
  ('firefighter', 'submit_vehicle_checks', true),
  ('firefighter', 'submit_maintenance', true),
  ('firefighter', 'manage_assets', false),
  ('firefighter', 'manage_locations', false),
  ('firefighter', 'manage_vehicle_check_templates', false),
  ('firefighter', 'manage_quiz_banks', false),
  ('firefighter', 'resolve_maintenance', false),
  ('firefighter', 'manage_users', false),
  -- Captain
  ('captain', 'browse_program_catalog', true),
  ('captain', 'self_enroll', true),
  ('captain', 'author_training', true),
  ('captain', 'ems_qi', true),
  ('captain', 'view_apparatus', true),
  ('captain', 'view_all_ppe', false),
  ('captain', 'submit_vehicle_checks', true),
  ('captain', 'submit_maintenance', true),
  ('captain', 'manage_assets', false),
  ('captain', 'manage_locations', false),
  ('captain', 'manage_vehicle_check_templates', false),
  ('captain', 'manage_quiz_banks', false),
  ('captain', 'resolve_maintenance', false),
  ('captain', 'manage_users', false)
on conflict (role, capability) do nothing;

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
          where c.role = p.role
            and c.capability = p_capability
            and c.enabled = true
        )
      )
  );
$$;

-- Training author / staff mutate helpers follow the capability matrix
create or replace function public.is_instructor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_capability('author_training');
$$;

-- Programs: catalog vs enrolled-only driven by browse_program_catalog
drop policy if exists "programs_select_published_or_owner_or_admin" on public.programs;
create policy "programs_select_published_or_owner_or_admin"
  on public.programs for select
  to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or (
      status = 'published'
      and (
        public.has_capability('browse_program_catalog')
        or public.is_enrolled_in_program(id)
      )
    )
  );

create or replace function public.can_access_module(p_module_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.program_modules pm
    join public.programs p on p.id = pm.program_id
    where pm.module_id = p_module_id
      and (
        p.created_by = auth.uid()
        or public.is_admin()
        or (
          p.status = 'published'
          and (
            public.has_capability('browse_program_catalog')
            or public.is_enrolled_in_module(p_module_id)
          )
        )
      )
  );
$$;

drop policy if exists "enrollments_insert_self_published" on public.enrollments;
create policy "enrollments_insert_self_published"
  on public.enrollments for insert
  to authenticated
  with check (
    (
      user_id = auth.uid()
      and public.has_capability('self_enroll')
      and exists (
        select 1 from public.programs p
        where p.id = program_id and p.status = 'published'
      )
    )
    or public.has_capability('author_training')
  );

drop policy if exists "module_enrollments_insert_self_accessible" on public.module_enrollments;
create policy "module_enrollments_insert_self_accessible"
  on public.module_enrollments for insert
  to authenticated
  with check (
    (
      user_id = auth.uid()
      and public.has_capability('self_enroll')
      and public.can_access_module(module_id)
    )
    or public.has_capability('author_training')
  );

-- Assets visibility driven by matrix
drop policy if exists "assets_select_visible" on public.assets;
create policy "assets_select_visible"
  on public.assets for select
  to authenticated
  using (
    public.is_admin()
    or public.has_capability('manage_assets')
    or (kind = 'apparatus' and public.has_capability('view_apparatus'))
    or (kind = 'ppe' and (public.has_capability('view_all_ppe') or assigned_to = auth.uid()))
  );

drop policy if exists "assets_insert_admin" on public.assets;
create policy "assets_insert_admin"
  on public.assets for insert
  to authenticated
  with check (public.has_capability('manage_assets'));

drop policy if exists "assets_update_admin" on public.assets;
create policy "assets_update_admin"
  on public.assets for update
  to authenticated
  using (public.has_capability('manage_assets'))
  with check (public.has_capability('manage_assets'));

drop policy if exists "assets_delete_admin" on public.assets;
create policy "assets_delete_admin"
  on public.assets for delete
  to authenticated
  using (public.has_capability('manage_assets'));

alter table public.permission_level_capabilities enable row level security;

drop policy if exists "permission_level_capabilities_select_authenticated" on public.permission_level_capabilities;
create policy "permission_level_capabilities_select_authenticated"
  on public.permission_level_capabilities for select
  to authenticated
  using (true);

drop policy if exists "permission_level_capabilities_mutate_admin" on public.permission_level_capabilities;
create policy "permission_level_capabilities_mutate_admin"
  on public.permission_level_capabilities for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Locations: manage via capability
drop policy if exists "locations_insert_admin" on public.locations;
drop policy if exists "locations_update_admin" on public.locations;
drop policy if exists "locations_delete_admin" on public.locations;

create policy "locations_insert_admin"
  on public.locations for insert
  to authenticated
  with check (public.has_capability('manage_locations'));

create policy "locations_update_admin"
  on public.locations for update
  to authenticated
  using (public.has_capability('manage_locations'))
  with check (public.has_capability('manage_locations'));

create policy "locations_delete_admin"
  on public.locations for delete
  to authenticated
  using (public.has_capability('manage_locations'));
