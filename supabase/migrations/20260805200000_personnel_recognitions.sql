-- Personnel recognitions (Ribbon Program sections 2–5)

create table if not exists public.personnel_recognitions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  award_id text not null,
  awarded_on date,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint personnel_recognitions_award_valid check (
    award_id in (
      'distinguished_service',
      'meritorious_service',
      'meritorious_unit_citation',
      'ems_life_saving',
      'dedication_and_devotion',
      'commissioners_award',
      'executive_fire_officer',
      'cpse_designation',
      'higher_education_degree',
      'paramedic_service',
      'certified_fire_marshal',
      'honor_guard',
      'hazmat_team',
      'rescue_technician'
    )
  )
);

create index if not exists personnel_recognitions_profile_id_idx
  on public.personnel_recognitions (profile_id);

create index if not exists personnel_recognitions_award_id_idx
  on public.personnel_recognitions (award_id);

alter table public.personnel_recognitions enable row level security;

drop policy if exists "personnel_recognitions_select" on public.personnel_recognitions;
create policy "personnel_recognitions_select"
  on public.personnel_recognitions for select
  to authenticated
  using (
    profile_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = personnel_recognitions.profile_id
        and p.supervisor_id = auth.uid()
    )
    or public.is_battalion_chief_of(personnel_recognitions.profile_id)
  );

drop policy if exists "personnel_recognitions_insert_admin" on public.personnel_recognitions;
create policy "personnel_recognitions_insert_admin"
  on public.personnel_recognitions for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "personnel_recognitions_update_admin" on public.personnel_recognitions;
create policy "personnel_recognitions_update_admin"
  on public.personnel_recognitions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "personnel_recognitions_delete_admin" on public.personnel_recognitions;
create policy "personnel_recognitions_delete_admin"
  on public.personnel_recognitions for delete
  to authenticated
  using (public.is_admin());

comment on table public.personnel_recognitions is
  'Ribbon Program awards (sections 2–5) recorded on a personnel file. Admin-managed.';
