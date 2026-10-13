-- Department-defined personnel ranks (replaces hardcoded fireRanks list).

create table if not exists public.personnel_ranks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  notes text not null default '',
  has_title boolean not null default false,
  title_only boolean not null default false,
  no_probation boolean not null default false,
  swing_up_eligible boolean not null default false,
  constraint personnel_ranks_client_name_unique unique (client_id, name),
  constraint personnel_ranks_name_not_blank check (length(trim(name)) > 0),
  constraint personnel_ranks_title_only_implies_has_title check (
    not title_only or has_title
  )
);

create index if not exists personnel_ranks_client_sort_idx
  on public.personnel_ranks (client_id, sort_order, name);
create index if not exists personnel_ranks_client_active_idx
  on public.personnel_ranks (client_id, is_active);

create or replace function public.set_personnel_ranks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists personnel_ranks_updated_at on public.personnel_ranks;
create trigger personnel_ranks_updated_at
  before update on public.personnel_ranks
  for each row
  execute function public.set_personnel_ranks_updated_at();

drop trigger if exists set_client_id_default on public.personnel_ranks;
create trigger set_client_id_default
  before insert on public.personnel_ranks
  for each row
  execute function public.set_row_client_id();

alter table public.personnel_ranks enable row level security;

drop policy if exists tenant_isolation on public.personnel_ranks;
create policy tenant_isolation
  on public.personnel_ranks
  as restrictive
  for all
  to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

drop policy if exists "personnel_ranks_select_authenticated" on public.personnel_ranks;
create policy "personnel_ranks_select_authenticated"
  on public.personnel_ranks for select
  to authenticated
  using (true);

drop policy if exists "personnel_ranks_insert_admin" on public.personnel_ranks;
create policy "personnel_ranks_insert_admin"
  on public.personnel_ranks for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "personnel_ranks_update_admin" on public.personnel_ranks;
create policy "personnel_ranks_update_admin"
  on public.personnel_ranks for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "personnel_ranks_delete_admin" on public.personnel_ranks;
create policy "personnel_ranks_delete_admin"
  on public.personnel_ranks for delete
  to authenticated
  using (public.is_admin());

-- Seed current hardcoded fire ranks for every department.
insert into public.personnel_ranks (
  client_id,
  name,
  sort_order,
  has_title,
  title_only,
  no_probation,
  swing_up_eligible
)
select
  c.id,
  seed.name,
  seed.sort_order,
  seed.has_title,
  seed.title_only,
  seed.no_probation,
  seed.swing_up_eligible
from public.clients c
cross join (
  values
    ('Firefighter', 1, false, false, false, false),
    ('Engineer', 2, false, false, false, true),
    ('Captain', 3, false, false, false, true),
    ('Battalion Chief', 4, false, false, false, true),
    ('Assistant Chief', 5, true, false, true, false),
    ('Division Chief', 6, true, false, true, false),
    ('Fire Chief', 7, false, false, true, false),
    ('Administration', 8, true, true, true, false)
) as seed (
  name,
  sort_order,
  has_title,
  title_only,
  no_probation,
  swing_up_eligible
)
on conflict (client_id, name) do nothing;
