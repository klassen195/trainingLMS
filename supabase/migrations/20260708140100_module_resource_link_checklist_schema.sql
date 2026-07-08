-- Schema for link and checklist module resources.

alter table public.module_resources
  drop constraint if exists module_resources_source_check;

alter table public.module_resources
  add constraint module_resources_source_check check (
    (
      resource_type = 'youtube'
      and external_url is not null
      and storage_path is null
    )
    or (
      resource_type = 'link'
      and external_url is not null
      and storage_path is null
      and file_name is null
    )
    or (
      resource_type in ('quiz', 'checklist')
      and storage_path is null
      and file_name is null
      and external_url is null
    )
    or (
      resource_type not in ('youtube', 'link', 'quiz', 'checklist')
      and storage_path is not null
      and file_name is not null
      and external_url is null
    )
  );

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.module_resources (id) on delete cascade,
  label text not null,
  sort_order integer not null default 0
);

create index checklist_items_resource_id_idx on public.checklist_items (resource_id, sort_order);

create table public.checklist_item_progress (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.checklist_items (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (item_id, user_id)
);

create index checklist_item_progress_user_id_idx on public.checklist_item_progress (user_id);

create or replace function public.can_access_checklist_resource(p_resource_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.module_resources mr
    where mr.id = p_resource_id
      and mr.resource_type = 'checklist'
      and public.can_access_module(mr.module_id)
  );
$$;

alter table public.checklist_items enable row level security;
alter table public.checklist_item_progress enable row level security;

create policy "checklist_items_select_if_resource_visible"
  on public.checklist_items for select
  to authenticated
  using (public.can_access_checklist_resource(resource_id));

create policy "checklist_items_mutate_module_owner"
  on public.checklist_items for all
  to authenticated
  using (
    exists (
      select 1
      from public.module_resources mr
      where mr.id = resource_id
        and public.can_manage_module(mr.module_id)
    )
  )
  with check (
    exists (
      select 1
      from public.module_resources mr
      where mr.id = resource_id
        and public.can_manage_module(mr.module_id)
    )
  );

create policy "checklist_item_progress_select_own_or_staff"
  on public.checklist_item_progress for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_instructor());

create policy "checklist_item_progress_insert_own_enrolled"
  on public.checklist_item_progress for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.checklist_items ci
      join public.module_resources mr on mr.id = ci.resource_id
      where ci.id = item_id
        and public.is_enrolled_in_module(mr.module_id)
    )
  );

create policy "checklist_item_progress_delete_own_enrolled"
  on public.checklist_item_progress for delete
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.checklist_items ci
      join public.module_resources mr on mr.id = ci.resource_id
      where ci.id = item_id
        and public.is_enrolled_in_module(mr.module_id)
    )
  );
