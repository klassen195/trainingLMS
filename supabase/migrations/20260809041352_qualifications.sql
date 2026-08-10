-- Qualifications catalog, session link, and personnel assignments

create table if not exists public.qualifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  notes text not null default '',
  constraint qualifications_name_unique unique (name),
  constraint qualifications_name_not_blank check (length(trim(name)) > 0)
);

create index if not exists qualifications_sort_order_idx
  on public.qualifications (sort_order, name);
create index if not exists qualifications_is_active_idx
  on public.qualifications (is_active);

create or replace function public.set_qualifications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists qualifications_updated_at on public.qualifications;
create trigger qualifications_updated_at
  before update on public.qualifications
  for each row
  execute function public.set_qualifications_updated_at();

alter table public.qualifications enable row level security;

drop policy if exists "qualifications_select_authenticated" on public.qualifications;
create policy "qualifications_select_authenticated"
  on public.qualifications for select
  to authenticated
  using (true);

drop policy if exists "qualifications_insert_admin" on public.qualifications;
create policy "qualifications_insert_admin"
  on public.qualifications for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "qualifications_update_admin" on public.qualifications;
create policy "qualifications_update_admin"
  on public.qualifications for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "qualifications_delete_admin" on public.qualifications;
create policy "qualifications_delete_admin"
  on public.qualifications for delete
  to authenticated
  using (public.is_admin());

-- Link optional qualification on training reports
alter table public.training_sessions
  add column if not exists qualification_id uuid
    references public.qualifications (id) on delete set null;

create index if not exists training_sessions_qualification_id_idx
  on public.training_sessions (qualification_id);

-- Personnel qualification assignments
create table if not exists public.personnel_qualifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  qualification_id uuid not null references public.qualifications (id) on delete restrict,
  earned_on date,
  notes text,
  source_session_id uuid references public.training_sessions (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint personnel_qualifications_profile_qualification_unique
    unique (profile_id, qualification_id)
);

create index if not exists personnel_qualifications_profile_id_idx
  on public.personnel_qualifications (profile_id);

create index if not exists personnel_qualifications_qualification_id_idx
  on public.personnel_qualifications (qualification_id);

create index if not exists personnel_qualifications_source_session_id_idx
  on public.personnel_qualifications (source_session_id);

alter table public.personnel_qualifications enable row level security;

drop policy if exists "personnel_qualifications_select" on public.personnel_qualifications;
create policy "personnel_qualifications_select"
  on public.personnel_qualifications for select
  to authenticated
  using (
    profile_id = auth.uid()
    or public.is_admin()
    or public.has_capability('document_training')
  );

drop policy if exists "personnel_qualifications_insert_admin" on public.personnel_qualifications;
create policy "personnel_qualifications_insert_admin"
  on public.personnel_qualifications for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "personnel_qualifications_insert_session_grant" on public.personnel_qualifications;
create policy "personnel_qualifications_insert_session_grant"
  on public.personnel_qualifications for insert
  to authenticated
  with check (
    public.has_capability('document_training')
    and source_session_id is not null
    and exists (
      select 1
      from public.training_sessions s
      where s.id = source_session_id
    )
  );

drop policy if exists "personnel_qualifications_update_admin" on public.personnel_qualifications;
create policy "personnel_qualifications_update_admin"
  on public.personnel_qualifications for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "personnel_qualifications_update_session_grant" on public.personnel_qualifications;
create policy "personnel_qualifications_update_session_grant"
  on public.personnel_qualifications for update
  to authenticated
  using (public.has_capability('document_training'))
  with check (
    public.has_capability('document_training')
    and source_session_id is not null
    and exists (
      select 1
      from public.training_sessions s
      where s.id = source_session_id
    )
  );

drop policy if exists "personnel_qualifications_delete_admin" on public.personnel_qualifications;
create policy "personnel_qualifications_delete_admin"
  on public.personnel_qualifications for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "personnel_qualifications_delete_session_grant" on public.personnel_qualifications;
create policy "personnel_qualifications_delete_session_grant"
  on public.personnel_qualifications for delete
  to authenticated
  using (
    public.has_capability('document_training')
    and source_session_id is not null
  );
