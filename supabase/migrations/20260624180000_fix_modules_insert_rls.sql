-- Fix modules RLS: allow INSERT ... RETURNING for newly created modules before
-- they are linked to a program via program_modules.

drop policy if exists "modules_select_own_creator" on public.modules;

create policy "modules_select_own_creator"
  on public.modules for select
  to authenticated
  using (created_by = auth.uid());

-- Ensure can_manage_module treats module creators and admins correctly.
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

-- Program owners may manage module links/order for their programs.
create or replace function public.can_manage_program_module(p_program_id uuid, p_module_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_program(p_program_id)
    and exists (
      select 1
      from public.program_modules pm
      where pm.program_id = p_program_id
        and pm.module_id = p_module_id
    );
$$;
