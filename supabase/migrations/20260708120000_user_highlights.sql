-- User-starred programs and modules for "My Programs" on the dashboard.

create table public.user_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  program_id uuid references public.programs (id) on delete cascade,
  module_id uuid references public.modules (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_highlights_target_check check (
    (program_id is not null and module_id is null)
    or (program_id is null and module_id is not null)
  )
);

create unique index user_highlights_user_program_idx
  on public.user_highlights (user_id, program_id)
  where program_id is not null;

create unique index user_highlights_user_module_idx
  on public.user_highlights (user_id, module_id)
  where module_id is not null;

create index user_highlights_user_id_idx on public.user_highlights (user_id);

alter table public.user_highlights enable row level security;

create policy "user_highlights_select_own"
  on public.user_highlights for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "user_highlights_insert_program"
  on public.user_highlights for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and program_id is not null
    and module_id is null
    and exists (
      select 1
      from public.programs p
      where p.id = program_id
        and (
          p.status = 'published'
          or p.created_by = (select auth.uid())
          or public.is_admin()
        )
    )
  );

create policy "user_highlights_insert_module"
  on public.user_highlights for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and module_id is not null
    and program_id is null
    and public.can_access_module(module_id)
  );

create policy "user_highlights_delete_own"
  on public.user_highlights for delete
  to authenticated
  using (user_id = (select auth.uid()));
