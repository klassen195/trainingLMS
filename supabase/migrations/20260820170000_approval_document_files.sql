-- Incoming Policy Tracker documents: new vs replacement, and a file that travels with the record.

alter table public.approval_documents
  add column if not exists submission_kind text;

update public.approval_documents
set submission_kind = 'new'
where submission_kind is null;

alter table public.approval_documents
  alter column submission_kind set default 'new';

alter table public.approval_documents
  alter column submission_kind set not null;

alter table public.approval_documents
  drop constraint if exists approval_documents_submission_kind_check;

alter table public.approval_documents
  add constraint approval_documents_submission_kind_check check (
    submission_kind in ('new', 'replacement')
  );

alter table public.approval_documents
  add column if not exists file_name text;

alter table public.approval_documents
  add column if not exists storage_path text;

alter table public.approval_documents
  add column if not exists mime_type text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'approval-tracker-files',
  'approval-tracker-files',
  false,
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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

-- Path layout: {document_id}/{file_id}/filename
drop policy if exists "approval_tracker_files_storage_select" on storage.objects;
create policy "approval_tracker_files_storage_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'approval-tracker-files'
    and public.has_capability('approval_tracker')
  );

drop policy if exists "approval_tracker_files_storage_insert" on storage.objects;
create policy "approval_tracker_files_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'approval-tracker-files'
    and public.has_capability('approval_tracker')
  );

drop policy if exists "approval_tracker_files_storage_update" on storage.objects;
create policy "approval_tracker_files_storage_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'approval-tracker-files'
    and public.has_capability('approval_tracker')
  )
  with check (
    bucket_id = 'approval-tracker-files'
    and public.has_capability('approval_tracker')
  );

drop policy if exists "approval_tracker_files_storage_delete" on storage.objects;
create policy "approval_tracker_files_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'approval-tracker-files'
    and public.has_capability('approval_tracker')
  );
