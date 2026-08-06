-- Battalion Chiefs automatically supervise everyone on their shift.
-- Captains continue to use profiles.supervisor_id.

create or replace function public.is_battalion_chief_of(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles me
    join public.profiles target on target.id = target_profile_id
    where me.id = auth.uid()
      and me.rank = 'Battalion Chief'
      and me.shift is not null
      and target.shift is not null
      and me.shift = target.shift
      and me.id is distinct from target.id
  );
$$;

create or replace function public.has_shift_battalion_chief(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles target
    join public.profiles bc
      on bc.rank = 'Battalion Chief'
     and bc.shift is not null
     and bc.shift = target.shift
     and bc.id is distinct from target.id
     and coalesce(bc.is_active, true) = true
    where target.id = target_profile_id
      and target.shift is not null
  );
$$;

drop policy if exists "personnel_taskbooks_select" on public.personnel_taskbooks;
create policy "personnel_taskbooks_select"
  on public.personnel_taskbooks for select
  to authenticated
  using (
    profile_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = personnel_taskbooks.profile_id
        and p.supervisor_id = auth.uid()
    )
    or public.is_battalion_chief_of(personnel_taskbooks.profile_id)
  );

drop policy if exists "personnel_taskbooks_update" on public.personnel_taskbooks;
create policy "personnel_taskbooks_update"
  on public.personnel_taskbooks for update
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = personnel_taskbooks.profile_id
        and p.supervisor_id = auth.uid()
    )
    or public.is_battalion_chief_of(personnel_taskbooks.profile_id)
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = personnel_taskbooks.profile_id
        and p.supervisor_id = auth.uid()
    )
    or public.is_battalion_chief_of(personnel_taskbooks.profile_id)
  );

comment on function public.is_battalion_chief_of(uuid) is
  'True when the current user is a Battalion Chief on the same shift as the target profile.';

comment on function public.has_shift_battalion_chief(uuid) is
  'True when the target profile has an active Battalion Chief on their shift.';
