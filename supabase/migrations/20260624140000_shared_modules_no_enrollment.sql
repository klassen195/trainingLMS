-- Shared modules: link modules to many programs via program_modules.
-- Remove enrollment requirement for viewing programs and marking progress.

create table public.program_modules (
  program_id uuid not null references public.programs (id) on delete cascade,
  module_id uuid not null references public.modules (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (program_id, module_id)
);

create index program_modules_module_id_idx on public.program_modules (module_id);

insert into public.program_modules (program_id, module_id, sort_order)
select program_id, id, sort_order
from public.modules;

alter table public.modules
  add column if not exists created_by uuid references public.profiles (id) on delete set null;

alter table public.modules drop column if exists program_id;
alter table public.modules drop column if exists sort_order;

create or replace function public.can_manage_program(p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.programs p
    where p.id = p_program_id
      and (p.created_by = auth.uid() or public.is_admin())
  );
$$;

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
    where m.id = p_module_id
      and (m.created_by = auth.uid() or public.is_admin())
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
    from public.program_modules pm
    join public.programs p on p.id = pm.program_id
    where pm.module_id = p_module_id
      and (
        p.created_by = auth.uid()
        or public.is_admin()
        or p.status = 'published'
      )
  );
$$;

alter table public.program_modules enable row level security;

drop policy if exists "modules_select_if_program_visible" on public.modules;
drop policy if exists "modules_mutate_program_owner" on public.modules;
drop policy if exists "programs_select_published_or_owner_or_admin" on public.programs;
drop policy if exists "module_progress_insert_own_enrolled" on public.module_progress;

create policy "programs_select_published_or_owner_or_admin"
  on public.programs for select
  to authenticated
  using (
    status = 'published'
    or created_by = auth.uid()
    or public.is_admin()
  );

create policy "modules_select_if_visible_or_manageable"
  on public.modules for select
  to authenticated
  using (
    public.can_manage_module(id)
    or public.can_access_module(id)
  );

create policy "modules_insert_instructor"
  on public.modules for insert
  to authenticated
  with check (public.is_instructor() and created_by = auth.uid());

create policy "modules_update_owner_or_admin"
  on public.modules for update
  to authenticated
  using (public.can_manage_module(id))
  with check (public.can_manage_module(id));

create policy "modules_delete_owner_or_admin"
  on public.modules for delete
  to authenticated
  using (public.can_manage_module(id));

create policy "program_modules_select_if_program_visible"
  on public.program_modules for select
  to authenticated
  using (
    exists (
      select 1
      from public.programs p
      where p.id = program_modules.program_id
        and (
          p.status = 'published'
          or p.created_by = auth.uid()
          or public.is_admin()
        )
    )
  );

create policy "program_modules_mutate_program_owner"
  on public.program_modules for all
  to authenticated
  using (public.can_manage_program(program_id))
  with check (public.can_manage_program(program_id));

create policy "module_progress_insert_own_accessible"
  on public.module_progress for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.can_access_module(module_id)
  );
