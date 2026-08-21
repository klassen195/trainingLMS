-- Optional file attachment on personnel certifications (reuse personnel-documents bucket).
-- Path layout matches documents: {profile_id}/{cert_id}/{filename}

alter table public.personnel_certifications
  add column if not exists file_name text,
  add column if not exists storage_path text,
  add column if not exists mime_type text;

alter table public.personnel_certifications
  drop constraint if exists personnel_certifications_file_pair;

alter table public.personnel_certifications
  add constraint personnel_certifications_file_pair check (
    (
      file_name is null
      and storage_path is null
      and mime_type is null
    )
    or (
      file_name is not null
      and length(trim(file_name)) > 0
      and storage_path is not null
      and length(trim(storage_path)) > 0
    )
  );
