-- Personnel module: org fields on profiles, certifications, documents + storage

alter table public.profiles
  add column if not exists employee_number text,
  add column if not exists job_title text,
  add column if not exists department text,
  add column if not exists phone text,
  add column if not exists hire_date date,
  add column if not exists primary_location_id uuid references public.locations (id) on delete set null,
  add column if not exists supervisor_id uuid references public.profiles (id) on delete set null;

create index if not exists profiles_primary_location_id_idx
  on public.profiles (primary_location_id);

create index if not exists profiles_supervisor_id_idx
  on public.profiles (supervisor_id);

-- Certifications (freeform)
create table if not exists public.personnel_certifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  issuing_authority text,
  issued_on date,
  expires_on date,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint personnel_certifications_name_nonempty check (length(trim(name)) > 0)
);

create index if not exists personnel_certifications_profile_id_idx
  on public.personnel_certifications (profile_id);

create index if not exists personnel_certifications_expires_on_idx
  on public.personnel_certifications (expires_on);

alter table public.personnel_certifications enable row level security;

drop policy if exists "personnel_certifications_select_own_or_admin" on public.personnel_certifications;
create policy "personnel_certifications_select_own_or_admin"
  on public.personnel_certifications for select
  to authenticated
  using (profile_id = auth.uid() or public.is_admin());

drop policy if exists "personnel_certifications_insert_admin" on public.personnel_certifications;
create policy "personnel_certifications_insert_admin"
  on public.personnel_certifications for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "personnel_certifications_update_admin" on public.personnel_certifications;
create policy "personnel_certifications_update_admin"
  on public.personnel_certifications for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "personnel_certifications_delete_admin" on public.personnel_certifications;
create policy "personnel_certifications_delete_admin"
  on public.personnel_certifications for delete
  to authenticated
  using (public.is_admin());

-- Documents
create table if not exists public.personnel_documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint personnel_documents_title_nonempty check (length(trim(title)) > 0),
  constraint personnel_documents_file_pair check (
    length(trim(file_name)) > 0 and length(trim(storage_path)) > 0
  )
);

create index if not exists personnel_documents_profile_id_idx
  on public.personnel_documents (profile_id);

alter table public.personnel_documents enable row level security;

drop policy if exists "personnel_documents_select_own_or_admin" on public.personnel_documents;
create policy "personnel_documents_select_own_or_admin"
  on public.personnel_documents for select
  to authenticated
  using (profile_id = auth.uid() or public.is_admin());

drop policy if exists "personnel_documents_insert_admin" on public.personnel_documents;
create policy "personnel_documents_insert_admin"
  on public.personnel_documents for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "personnel_documents_update_admin" on public.personnel_documents;
create policy "personnel_documents_update_admin"
  on public.personnel_documents for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "personnel_documents_delete_admin" on public.personnel_documents;
create policy "personnel_documents_delete_admin"
  on public.personnel_documents for delete
  to authenticated
  using (public.is_admin());

-- Storage bucket for personnel documents
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'personnel-documents',
  'personnel-documents',
  false,
  20971520,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path layout: {profile_id}/{doc_id}/filename
drop policy if exists "personnel_documents_storage_select" on storage.objects;
create policy "personnel_documents_storage_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'personnel-documents'
    and (
      public.is_admin()
      or split_part(name, '/', 1) = auth.uid()::text
    )
  );

drop policy if exists "personnel_documents_storage_insert" on storage.objects;
create policy "personnel_documents_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'personnel-documents'
    and public.is_admin()
  );

drop policy if exists "personnel_documents_storage_update" on storage.objects;
create policy "personnel_documents_storage_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'personnel-documents' and public.is_admin())
  with check (bucket_id = 'personnel-documents' and public.is_admin());

drop policy if exists "personnel_documents_storage_delete" on storage.objects;
create policy "personnel_documents_storage_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'personnel-documents' and public.is_admin());

-- Allow staff to remove enrollments for others (assign/unassign from personnel)
drop policy if exists "module_enrollments_delete_own" on public.module_enrollments;
drop policy if exists "module_enrollments_delete_own_or_staff" on public.module_enrollments;
create policy "module_enrollments_delete_own_or_staff"
  on public.module_enrollments for delete
  to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_instructor());
