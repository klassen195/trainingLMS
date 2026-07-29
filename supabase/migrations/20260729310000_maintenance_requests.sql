-- Apparatus maintenance requests + photo storage

do $$
begin
  if not exists (select 1 from pg_type where typname = 'maintenance_request_type') then
    create type public.maintenance_request_type as enum (
      'major',
      'minor',
      'scheduled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'maintenance_service_status') then
    create type public.maintenance_service_status as enum (
      'in_service',
      'out_of_service'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'maintenance_request_status') then
    create type public.maintenance_request_status as enum (
      'open',
      'resolved'
    );
  end if;
end $$;

create table if not exists public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  requested_by uuid null references public.profiles (id) on delete restrict,
  requested_at timestamptz not null default now(),

  service_status public.maintenance_service_status not null,
  request_type public.maintenance_request_type not null,
  description text not null default '',

  photo_storage_path text null,
  photo_file_name text null,

  vehicle_check_id uuid null references public.vehicle_checks (id) on delete set null,

  status public.maintenance_request_status not null default 'open',
  resolved_at timestamptz null,
  resolved_by uuid null references public.profiles (id) on delete set null,
  resolved_note text null,

  constraint maintenance_requests_photo_pair check (
    (photo_storage_path is null and photo_file_name is null)
    or (photo_storage_path is not null and photo_file_name is not null)
  )
);

create index if not exists maintenance_requests_asset_id_requested_at_idx
  on public.maintenance_requests (asset_id, requested_at desc);

create index if not exists maintenance_requests_status_requested_at_idx
  on public.maintenance_requests (status, requested_at desc);

create or replace function public.maintenance_requests_require_apparatus()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  asset_kind public.asset_kind;
begin
  select kind into asset_kind from public.assets where id = new.asset_id;
  if asset_kind is distinct from 'apparatus' then
    raise exception 'Maintenance requests can only be created for apparatus.';
  end if;
  return new;
end;
$$;

drop trigger if exists maintenance_requests_require_apparatus on public.maintenance_requests;
create trigger maintenance_requests_require_apparatus
before insert or update of asset_id on public.maintenance_requests
for each row
execute function public.maintenance_requests_require_apparatus();

drop trigger if exists maintenance_requests_set_out_of_service on public.maintenance_requests;
drop function if exists public.maintenance_requests_set_out_of_service();

create or replace function public.maintenance_request_apply_out_of_service(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req record;
begin
  select id, asset_id, service_status, requested_by, status
  into req
  from public.maintenance_requests
  where id = p_request_id;

  if not found then
    raise exception 'Maintenance request not found.';
  end if;

  if req.status is distinct from 'open' then
    raise exception 'Maintenance request is not open.';
  end if;

  if req.requested_by is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Not allowed to update apparatus status for this request.';
  end if;

  if req.service_status = 'out_of_service' then
    update public.assets
    set status = 'out_of_service'
    where id = req.asset_id
      and status is distinct from 'out_of_service';
  end if;
end;
$$;

revoke all on function public.maintenance_request_apply_out_of_service(uuid) from public;
grant execute on function public.maintenance_request_apply_out_of_service(uuid) to authenticated;

create or replace function public.maintenance_requests_set_resolved_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'UPDATE') and (old.status = 'open') and (new.status = 'resolved') then
    new.resolved_at := now();
    new.resolved_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists maintenance_requests_set_resolved_metadata on public.maintenance_requests;
create trigger maintenance_requests_set_resolved_metadata
before update on public.maintenance_requests
for each row
execute function public.maintenance_requests_set_resolved_metadata();

alter table public.maintenance_requests enable row level security;

drop policy if exists "maintenance_requests_select_authenticated" on public.maintenance_requests;
create policy "maintenance_requests_select_authenticated"
  on public.maintenance_requests for select
  to authenticated
  using (true);

drop policy if exists "maintenance_requests_insert_authenticated" on public.maintenance_requests;
create policy "maintenance_requests_insert_authenticated"
  on public.maintenance_requests for insert
  to authenticated
  with check (true);

drop policy if exists "maintenance_requests_update_admin" on public.maintenance_requests;
create policy "maintenance_requests_update_admin"
  on public.maintenance_requests for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "maintenance_requests_delete_own_open" on public.maintenance_requests;
create policy "maintenance_requests_delete_own_open"
  on public.maintenance_requests for delete
  to authenticated
  using (
    status = 'open'
    and requested_by = auth.uid()
  );

-- Requesters may only set/clear photo fields on their own open requests (not resolve).
create or replace function public.maintenance_request_set_photo(
  p_request_id uuid,
  p_storage_path text,
  p_file_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_storage_path is null or p_file_name is null then
    raise exception 'Photo path and file name are required.';
  end if;

  update public.maintenance_requests
  set
    photo_storage_path = p_storage_path,
    photo_file_name = p_file_name
  where id = p_request_id
    and status = 'open'
    and requested_by = auth.uid();

  if not found then
    raise exception 'Maintenance request not found or not editable.';
  end if;
end;
$$;

revoke all on function public.maintenance_request_set_photo(uuid, text, text) from public;
grant execute on function public.maintenance_request_set_photo(uuid, text, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'maintenance-photos',
  'maintenance-photos',
  false,
  20971520,
  array[
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

drop policy if exists "maintenance_photos_storage_select" on storage.objects;
create policy "maintenance_photos_storage_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'maintenance-photos');

drop policy if exists "maintenance_photos_storage_insert" on storage.objects;
create policy "maintenance_photos_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'maintenance-photos');

drop policy if exists "maintenance_photos_storage_update" on storage.objects;
create policy "maintenance_photos_storage_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'maintenance-photos')
  with check (bucket_id = 'maintenance-photos');

drop policy if exists "maintenance_photos_storage_delete" on storage.objects;
create policy "maintenance_photos_storage_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'maintenance-photos');
