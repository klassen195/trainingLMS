-- Optional completion document + PDIP eligibility on personnel taskbooks.
-- Path layout matches documents/certs: {profile_id}/{taskbook_id}/{filename}

alter table public.personnel_taskbooks
  add column if not exists file_name text,
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists pdip_eligible boolean not null default false;

alter table public.personnel_taskbooks
  drop constraint if exists personnel_taskbooks_file_pair;

alter table public.personnel_taskbooks
  add constraint personnel_taskbooks_file_pair check (
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
