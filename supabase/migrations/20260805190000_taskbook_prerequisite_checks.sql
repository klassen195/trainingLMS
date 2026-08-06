-- Member-checked prerequisites for taskbooks (does not gate apply/issue)

create table if not exists public.personnel_taskbook_prerequisite_checks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  rank text not null,
  prerequisite_id text not null,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint personnel_taskbook_prereq_rank_valid check (
    rank in (
      'Firefighter',
      'Engineer',
      'Captain',
      'Battalion Chief',
      'Fire Boat Operator',
      'Drone Operator',
      'REMS'
    )
  ),
  constraint personnel_taskbook_prereq_unique unique (profile_id, rank, prerequisite_id)
);

create index if not exists personnel_taskbook_prereq_profile_id_idx
  on public.personnel_taskbook_prerequisite_checks (profile_id);

alter table public.personnel_taskbook_prerequisite_checks enable row level security;

drop policy if exists "personnel_taskbook_prereq_select" on public.personnel_taskbook_prerequisite_checks;
create policy "personnel_taskbook_prereq_select"
  on public.personnel_taskbook_prerequisite_checks for select
  to authenticated
  using (
    profile_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = personnel_taskbook_prerequisite_checks.profile_id
        and p.supervisor_id = auth.uid()
    )
    or public.is_battalion_chief_of(personnel_taskbook_prerequisite_checks.profile_id)
  );

drop policy if exists "personnel_taskbook_prereq_insert" on public.personnel_taskbook_prerequisite_checks;
create policy "personnel_taskbook_prereq_insert"
  on public.personnel_taskbook_prerequisite_checks for insert
  to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "personnel_taskbook_prereq_delete" on public.personnel_taskbook_prerequisite_checks;
create policy "personnel_taskbook_prereq_delete"
  on public.personnel_taskbook_prerequisite_checks for delete
  to authenticated
  using (profile_id = auth.uid());

drop policy if exists "personnel_taskbook_prereq_update" on public.personnel_taskbook_prerequisite_checks;
create policy "personnel_taskbook_prereq_update"
  on public.personnel_taskbook_prerequisite_checks for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

comment on table public.personnel_taskbook_prerequisite_checks is
  'Self-reported prerequisite checklist progress per person and taskbook. Does not block apply or issue.';
