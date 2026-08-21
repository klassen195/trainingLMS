-- Separate "delete training reports" from documenting training.

alter table public.permission_level_capabilities
  drop constraint if exists permission_level_capabilities_capability_check;

alter table public.permission_level_capabilities
  add constraint permission_level_capabilities_capability_check check (
    capability in (
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

insert into public.permission_level_capabilities (client_id, permission_level_id, capability, enabled)
select pl.client_id, pl.id, 'delete_training_reports', false
from public.permission_levels pl
on conflict (permission_level_id, capability) do nothing;

create or replace function public.permission_levels_seed_capabilities()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.permission_level_capabilities (client_id, permission_level_id, capability, enabled)
  select new.client_id, new.id, cap, false
  from unnest(array[
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
  return new;
end;
$$;

drop policy if exists "training_sessions_delete" on public.training_sessions;
create policy "training_sessions_delete"
  on public.training_sessions for delete
  to authenticated
  using (
    public.has_capability('delete_training_reports')
    or (
      public.has_capability('document_training')
      and recorded_by = auth.uid()
    )
  );

drop policy if exists "personnel_qualifications_delete_session_grant" on public.personnel_qualifications;
create policy "personnel_qualifications_delete_session_grant"
  on public.personnel_qualifications for delete
  to authenticated
  using (
    source_session_id is not null
    and (
      public.has_capability('document_training')
      or public.has_capability('delete_training_reports')
    )
  );

drop policy if exists "training_session_files_storage_delete" on storage.objects;
create policy "training_session_files_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'training-session-files'
    and (
      public.has_capability('document_training')
      or public.has_capability('delete_training_reports')
    )
  );
