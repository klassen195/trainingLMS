-- Optional per-module enrollment gates progress tracking.

create table public.module_enrollments (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  unique (module_id, user_id)
);

create index module_enrollments_user_id_idx on public.module_enrollments (user_id);

create or replace function public.is_enrolled_in_module(p_module_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.module_enrollments me
    where me.module_id = p_module_id
      and me.user_id = auth.uid()
  );
$$;

alter table public.module_enrollments enable row level security;

create policy "module_enrollments_select_own_or_staff"
  on public.module_enrollments for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_instructor());

create policy "module_enrollments_insert_self_accessible"
  on public.module_enrollments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.can_access_module(module_id)
  );

create policy "module_enrollments_delete_own"
  on public.module_enrollments for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "module_progress_insert_own_accessible" on public.module_progress;

create policy "module_progress_insert_own_enrolled"
  on public.module_progress for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_enrolled_in_module(module_id)
  );

create policy "module_progress_update_own_enrolled"
  on public.module_progress for update
  to authenticated
  using (user_id = auth.uid() and public.is_enrolled_in_module(module_id))
  with check (user_id = auth.uid() and public.is_enrolled_in_module(module_id));

create policy "module_progress_delete_own_enrolled"
  on public.module_progress for delete
  to authenticated
  using (user_id = auth.uid() and public.is_enrolled_in_module(module_id));

drop policy if exists "resource_progress_insert_own_accessible" on public.resource_progress;

create policy "resource_progress_insert_own_enrolled"
  on public.resource_progress for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.module_resources mr
      where mr.id = resource_id
        and public.is_enrolled_in_module(mr.module_id)
    )
  );

drop policy if exists "resource_progress_update_own" on public.resource_progress;

create policy "resource_progress_update_own_enrolled"
  on public.resource_progress for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.module_resources mr
      where mr.id = resource_id
        and public.is_enrolled_in_module(mr.module_id)
    )
  )
  with check (user_id = auth.uid());

create policy "resource_progress_delete_own_enrolled"
  on public.resource_progress for delete
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.module_resources mr
      where mr.id = resource_id
        and public.is_enrolled_in_module(mr.module_id)
    )
  );
