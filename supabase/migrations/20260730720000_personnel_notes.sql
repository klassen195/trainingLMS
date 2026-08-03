-- Personnel notes on member files

create table if not exists public.personnel_notes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint personnel_notes_body_nonempty check (length(trim(body)) > 0)
);

create index if not exists personnel_notes_profile_id_idx
  on public.personnel_notes (profile_id);

create index if not exists personnel_notes_created_at_idx
  on public.personnel_notes (created_at desc);

alter table public.personnel_notes enable row level security;

drop policy if exists "personnel_notes_select_own_or_admin" on public.personnel_notes;
create policy "personnel_notes_select_own_or_admin"
  on public.personnel_notes for select
  to authenticated
  using (profile_id = auth.uid() or public.is_admin());

drop policy if exists "personnel_notes_insert_admin" on public.personnel_notes;
create policy "personnel_notes_insert_admin"
  on public.personnel_notes for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "personnel_notes_delete_admin" on public.personnel_notes;
create policy "personnel_notes_delete_admin"
  on public.personnel_notes for delete
  to authenticated
  using (public.is_admin());
