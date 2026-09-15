-- Personal certification layout: named section breaks and a stable sort order.

alter table public.personnel_certifications
  add column if not exists sort_order integer;

with ordered as (
  select
    id,
    row_number() over (
      partition by profile_id
      order by expires_on asc nulls last, name, created_at, id
    ) - 1 as rn
  from public.personnel_certifications
)
update public.personnel_certifications as certs
set sort_order = ordered.rn
from ordered
where certs.id = ordered.id
  and certs.sort_order is null;

update public.personnel_certifications
set sort_order = 0
where sort_order is null;

alter table public.personnel_certifications
  alter column sort_order set default 0;

alter table public.personnel_certifications
  alter column sort_order set not null;

create index if not exists personnel_certifications_profile_sort_idx
  on public.personnel_certifications (profile_id, sort_order);

create table if not exists public.personnel_certification_sections (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint personnel_certification_sections_name_nonempty check (length(trim(name)) > 0)
);

create index if not exists personnel_certification_sections_profile_sort_idx
  on public.personnel_certification_sections (profile_id, sort_order);

drop trigger if exists set_client_id_default on public.personnel_certification_sections;
create trigger set_client_id_default
  before insert on public.personnel_certification_sections
  for each row
  execute function public.set_row_client_id();

alter table public.personnel_certification_sections enable row level security;

drop policy if exists tenant_isolation on public.personnel_certification_sections;
create policy tenant_isolation on public.personnel_certification_sections
  as restrictive for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

drop policy if exists "personnel_certification_sections_select" on public.personnel_certification_sections;
create policy "personnel_certification_sections_select"
  on public.personnel_certification_sections for select
  to authenticated
  using (
    profile_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = personnel_certification_sections.profile_id
        and p.supervisor_id = auth.uid()
    )
    or public.is_battalion_chief_of(personnel_certification_sections.profile_id)
  );

drop policy if exists "personnel_certification_sections_write_own_or_admin" on public.personnel_certification_sections;
create policy "personnel_certification_sections_write_own_or_admin"
  on public.personnel_certification_sections for all
  to authenticated
  using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

comment on table public.personnel_certification_sections is
  'Named section breaks on a personnel certification list. Owned and ordered by that person.';
