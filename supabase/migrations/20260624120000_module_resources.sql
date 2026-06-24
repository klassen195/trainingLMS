-- Module resources: videos, PDFs, and PowerPoints attached to modules.

create type public.module_resource_type as enum ('video', 'pdf', 'powerpoint');

create table public.module_resources (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  title text not null,
  resource_type public.module_resource_type not null,
  storage_path text not null,
  file_name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index module_resources_module_id_sort_order_idx
  on public.module_resources (module_id, sort_order);

create or replace function public.can_manage_module(p_module_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.modules m
    join public.programs p on p.id = m.program_id
    where m.id = p_module_id
      and (p.created_by = auth.uid() or public.is_admin())
  );
$$;

create or replace function public.can_access_module(p_module_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.modules m
    join public.programs p on p.id = m.program_id
    where m.id = p_module_id
      and (
        p.created_by = auth.uid()
        or public.is_admin()
        or (p.status = 'published' and public.is_enrolled(p.id))
      )
  );
$$;

alter table public.module_resources enable row level security;

create policy "module_resources_select_if_module_visible"
  on public.module_resources for select
  to authenticated
  using (public.can_access_module(module_id));

create policy "module_resources_mutate_module_owner"
  on public.module_resources for all
  to authenticated
  using (public.can_manage_module(module_id))
  with check (public.can_manage_module(module_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'module-resources',
  'module-resources',
  false,
  524288000,
  array[
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "module_resources_storage_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'module-resources'
    and public.can_access_module(((storage.foldername(name))[1])::uuid)
  );

create policy "module_resources_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'module-resources'
    and public.can_manage_module(((storage.foldername(name))[1])::uuid)
  );

create policy "module_resources_storage_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'module-resources'
    and public.can_manage_module(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'module-resources'
    and public.can_manage_module(((storage.foldername(name))[1])::uuid)
  );

create policy "module_resources_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'module-resources'
    and public.can_manage_module(((storage.foldername(name))[1])::uuid)
  );
