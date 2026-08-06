-- Document Training: logged in-house sessions and certification courses

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
      'manage_incidents'
    )
  );

insert into public.permission_level_capabilities (role, capability, enabled)
values
  ('recruit', 'document_training', false),
  ('firefighter', 'document_training', true),
  ('captain', 'document_training', true)
on conflict (role, capability) do nothing;

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  session_type text not null,
  title text not null,
  hours numeric(6, 2),
  location text,
  notes text,
  -- in-house
  occurred_on date,
  instructor_name text,
  -- certification course
  provider text,
  started_on date,
  ended_on date,
  expires_on date,
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_sessions_title_nonempty check (length(trim(title)) > 0),
  constraint training_sessions_type_check check (
    session_type in ('in_house', 'certification_course')
  ),
  constraint training_sessions_hours_nonnegative check (hours is null or hours >= 0),
  constraint training_sessions_in_house_fields check (
    session_type <> 'in_house'
    or (
      occurred_on is not null
      and instructor_name is not null
      and length(trim(instructor_name)) > 0
    )
  ),
  constraint training_sessions_cert_fields check (
    session_type <> 'certification_course'
    or (
      provider is not null
      and length(trim(provider)) > 0
      and started_on is not null
    )
  )
);

create index if not exists training_sessions_created_at_idx
  on public.training_sessions (created_at desc);

create index if not exists training_sessions_session_type_idx
  on public.training_sessions (session_type);

create index if not exists training_sessions_recorded_by_idx
  on public.training_sessions (recorded_by);

create or replace function public.set_training_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists training_sessions_updated_at on public.training_sessions;
create trigger training_sessions_updated_at
  before update on public.training_sessions
  for each row
  execute function public.set_training_sessions_updated_at();

alter table public.training_sessions enable row level security;

drop policy if exists "training_sessions_select" on public.training_sessions;
create policy "training_sessions_select"
  on public.training_sessions for select
  to authenticated
  using (public.has_capability('document_training'));

drop policy if exists "training_sessions_insert" on public.training_sessions;
create policy "training_sessions_insert"
  on public.training_sessions for insert
  to authenticated
  with check (
    public.has_capability('document_training')
    and recorded_by = auth.uid()
  );

drop policy if exists "training_sessions_update" on public.training_sessions;
create policy "training_sessions_update"
  on public.training_sessions for update
  to authenticated
  using (
    public.has_capability('document_training')
    and (recorded_by = auth.uid() or public.is_admin())
  )
  with check (
    public.has_capability('document_training')
    and (recorded_by = auth.uid() or public.is_admin())
  );

drop policy if exists "training_sessions_delete" on public.training_sessions;
create policy "training_sessions_delete"
  on public.training_sessions for delete
  to authenticated
  using (
    public.has_capability('document_training')
    and (recorded_by = auth.uid() or public.is_admin())
  );

create table if not exists public.training_session_attendees (
  session_id uuid not null references public.training_sessions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, profile_id)
);

create index if not exists training_session_attendees_profile_id_idx
  on public.training_session_attendees (profile_id);

alter table public.training_session_attendees enable row level security;

drop policy if exists "training_session_attendees_select" on public.training_session_attendees;
create policy "training_session_attendees_select"
  on public.training_session_attendees for select
  to authenticated
  using (public.has_capability('document_training'));

drop policy if exists "training_session_attendees_insert" on public.training_session_attendees;
create policy "training_session_attendees_insert"
  on public.training_session_attendees for insert
  to authenticated
  with check (
    public.has_capability('document_training')
    and exists (
      select 1
      from public.training_sessions s
      where s.id = session_id
        and (s.recorded_by = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "training_session_attendees_delete" on public.training_session_attendees;
create policy "training_session_attendees_delete"
  on public.training_session_attendees for delete
  to authenticated
  using (
    public.has_capability('document_training')
    and exists (
      select 1
      from public.training_sessions s
      where s.id = session_id
        and (s.recorded_by = auth.uid() or public.is_admin())
    )
  );

create table if not exists public.training_session_files (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint training_session_files_file_pair check (
    length(trim(file_name)) > 0 and length(trim(storage_path)) > 0
  )
);

create index if not exists training_session_files_session_id_idx
  on public.training_session_files (session_id);

alter table public.training_session_files enable row level security;

drop policy if exists "training_session_files_select" on public.training_session_files;
create policy "training_session_files_select"
  on public.training_session_files for select
  to authenticated
  using (public.has_capability('document_training'));

drop policy if exists "training_session_files_insert" on public.training_session_files;
create policy "training_session_files_insert"
  on public.training_session_files for insert
  to authenticated
  with check (
    public.has_capability('document_training')
    and uploaded_by = auth.uid()
    and exists (
      select 1
      from public.training_sessions s
      where s.id = session_id
        and (s.recorded_by = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "training_session_files_delete" on public.training_session_files;
create policy "training_session_files_delete"
  on public.training_session_files for delete
  to authenticated
  using (
    public.has_capability('document_training')
    and exists (
      select 1
      from public.training_sessions s
      where s.id = session_id
        and (s.recorded_by = auth.uid() or public.is_admin())
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'training-session-files',
  'training-session-files',
  false,
  20971520,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path layout: {session_id}/{file_id}/filename
drop policy if exists "training_session_files_storage_select" on storage.objects;
create policy "training_session_files_storage_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'training-session-files'
    and public.has_capability('document_training')
  );

drop policy if exists "training_session_files_storage_insert" on storage.objects;
create policy "training_session_files_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'training-session-files'
    and public.has_capability('document_training')
  );

drop policy if exists "training_session_files_storage_update" on storage.objects;
create policy "training_session_files_storage_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'training-session-files'
    and public.has_capability('document_training')
  )
  with check (
    bucket_id = 'training-session-files'
    and public.has_capability('document_training')
  );

drop policy if exists "training_session_files_storage_delete" on storage.objects;
create policy "training_session_files_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'training-session-files'
    and public.has_capability('document_training')
  );
