-- Per-resource completion tracking for module resources.

create table public.resource_progress (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.module_resources (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (resource_id, user_id)
);

create index resource_progress_user_id_idx on public.resource_progress (user_id);

alter table public.resource_progress enable row level security;

create policy "resource_progress_select_own_or_staff"
  on public.resource_progress for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_instructor());

create policy "resource_progress_insert_own_accessible"
  on public.resource_progress for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.module_resources mr
      where mr.id = resource_id
        and public.can_access_module(mr.module_id)
    )
  );

create policy "resource_progress_update_own"
  on public.resource_progress for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
