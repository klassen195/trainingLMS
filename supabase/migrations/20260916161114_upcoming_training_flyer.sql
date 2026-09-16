-- Optional flyer attachment for upcoming training announcements.

alter table public.upcoming_trainings
  add column if not exists flyer_file_name text,
  add column if not exists flyer_storage_path text,
  add column if not exists flyer_mime_type text;

comment on column public.upcoming_trainings.flyer_storage_path is
  'Private storage path for the optional training flyer.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'upcoming-training-flyers',
  'upcoming-training-flyers',
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

-- Path layout: {upcoming_training_id}/{file_id}/filename
drop policy if exists "upcoming_training_flyers_storage_select" on storage.objects;
create policy "upcoming_training_flyers_storage_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'upcoming-training-flyers'
    and (
      public.has_capability('document_training')
      or public.has_capability('manage_upcoming_training')
      or public.is_admin()
    )
  );

drop policy if exists "upcoming_training_flyers_storage_insert" on storage.objects;
create policy "upcoming_training_flyers_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'upcoming-training-flyers'
    and (public.has_capability('manage_upcoming_training') or public.is_admin())
  );

drop policy if exists "upcoming_training_flyers_storage_update" on storage.objects;
create policy "upcoming_training_flyers_storage_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'upcoming-training-flyers'
    and (public.has_capability('manage_upcoming_training') or public.is_admin())
  )
  with check (
    bucket_id = 'upcoming-training-flyers'
    and (public.has_capability('manage_upcoming_training') or public.is_admin())
  );

drop policy if exists "upcoming_training_flyers_storage_delete" on storage.objects;
create policy "upcoming_training_flyers_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'upcoming-training-flyers'
    and (public.has_capability('manage_upcoming_training') or public.is_admin())
  );
