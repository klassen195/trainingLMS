-- Personnel taskbooks: request / approve / one-year clock / completion → swing-up

create table if not exists public.personnel_taskbooks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  rank text not null,
  status text not null default 'requested',
  requested_at timestamptz not null default now(),
  approved_on date,
  due_on date,
  completed_on date,
  denied_on date,
  denial_reason text,
  notes text,
  requested_by uuid references public.profiles (id) on delete set null,
  decided_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint personnel_taskbooks_rank_valid check (
    rank in ('Firefighter', 'Engineer', 'Captain', 'Battalion Chief')
  ),
  constraint personnel_taskbooks_status_valid check (
    status in ('requested', 'denied', 'active', 'completed')
  ),
  constraint personnel_taskbooks_active_dates check (
    status not in ('active', 'completed')
    or (approved_on is not null and due_on is not null and due_on >= approved_on)
  )
);

create index if not exists personnel_taskbooks_profile_id_idx
  on public.personnel_taskbooks (profile_id);

create index if not exists personnel_taskbooks_status_idx
  on public.personnel_taskbooks (status);

-- One open (requested or active) book per person + rank
create unique index if not exists personnel_taskbooks_one_open_per_rank_idx
  on public.personnel_taskbooks (profile_id, rank)
  where status in ('requested', 'active');

alter table public.personnel_taskbooks enable row level security;

-- Supervisors can read profiles they supervise (needed for approval UI / joins)
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_admin_or_supervisor"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or supervisor_id = auth.uid()
  );

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
  );

drop policy if exists "personnel_taskbooks_insert" on public.personnel_taskbooks;
create policy "personnel_taskbooks_insert"
  on public.personnel_taskbooks for insert
  to authenticated
  with check (
    public.is_admin()
    or profile_id = auth.uid()
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
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = personnel_taskbooks.profile_id
        and p.supervisor_id = auth.uid()
    )
  );

drop policy if exists "personnel_taskbooks_delete" on public.personnel_taskbooks;
create policy "personnel_taskbooks_delete"
  on public.personnel_taskbooks for delete
  to authenticated
  using (public.is_admin());

comment on table public.personnel_taskbooks is
  'Rank taskbooks: member request → supervisor approve (starts 1-year clock) → complete may grant swing-up.';
