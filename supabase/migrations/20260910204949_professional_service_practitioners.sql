-- Practitioners under a professional service provider; reviews can target practice or person.

create table if not exists public.professional_service_practitioners (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  provider_id uuid not null references public.professional_service_providers (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  role_title text not null default '',
  notes text not null default '',
  is_hidden boolean not null default false,
  constraint professional_service_practitioners_name_nonempty check (length(trim(name)) > 0)
);

create index if not exists professional_service_practitioners_provider_idx
  on public.professional_service_practitioners (provider_id, name);

create index if not exists professional_service_practitioners_client_idx
  on public.professional_service_practitioners (client_id, provider_id);

create or replace function public.set_professional_service_practitioners_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists professional_service_practitioners_updated_at
  on public.professional_service_practitioners;
create trigger professional_service_practitioners_updated_at
  before update on public.professional_service_practitioners
  for each row
  execute function public.set_professional_service_practitioners_updated_at();

drop trigger if exists set_client_id_default on public.professional_service_practitioners;
create trigger set_client_id_default
  before insert on public.professional_service_practitioners
  for each row
  execute function public.set_row_client_id();

alter table public.professional_service_reviews
  add column if not exists practitioner_id uuid
    references public.professional_service_practitioners (id) on delete cascade;

drop index if exists public.professional_service_reviews_one_per_user_idx;

create unique index if not exists professional_service_reviews_one_per_user_org_idx
  on public.professional_service_reviews (client_id, provider_id, created_by)
  where practitioner_id is null;

create unique index if not exists professional_service_reviews_one_per_user_person_idx
  on public.professional_service_reviews (client_id, provider_id, practitioner_id, created_by)
  where practitioner_id is not null;

create index if not exists professional_service_reviews_practitioner_idx
  on public.professional_service_reviews (practitioner_id, created_at desc);

create or replace function public.professional_service_reviews_practitioner_matches_provider()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.practitioner_id is null then
    return new;
  end if;
  if not exists (
    select 1
    from public.professional_service_practitioners pr
    where pr.id = new.practitioner_id
      and pr.provider_id = new.provider_id
      and pr.client_id = new.client_id
  ) then
    raise exception 'Practitioner must belong to the same provider';
  end if;
  return new;
end;
$$;

drop trigger if exists professional_service_reviews_practitioner_provider
  on public.professional_service_reviews;
create trigger professional_service_reviews_practitioner_provider
  before insert or update on public.professional_service_reviews
  for each row
  execute function public.professional_service_reviews_practitioner_matches_provider();

alter table public.professional_service_practitioners enable row level security;

drop policy if exists tenant_isolation on public.professional_service_practitioners;
create policy tenant_isolation on public.professional_service_practitioners
  as restrictive for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

drop policy if exists professional_service_practitioners_select
  on public.professional_service_practitioners;
create policy professional_service_practitioners_select
  on public.professional_service_practitioners for select
  to authenticated
  using (
    public.has_capability('access_professional_services')
    and (not is_hidden or public.is_admin() or created_by = auth.uid())
    and exists (
      select 1
      from public.professional_service_providers p
      where p.id = provider_id
        and (
          not p.is_hidden
          or public.is_admin()
          or p.created_by = auth.uid()
        )
    )
  );

drop policy if exists professional_service_practitioners_insert
  on public.professional_service_practitioners;
create policy professional_service_practitioners_insert
  on public.professional_service_practitioners for insert
  to authenticated
  with check (public.has_capability('access_professional_services'));

drop policy if exists professional_service_practitioners_update
  on public.professional_service_practitioners;
create policy professional_service_practitioners_update
  on public.professional_service_practitioners for update
  to authenticated
  using (
    public.has_capability('access_professional_services')
    and (created_by = auth.uid() or public.is_admin())
  )
  with check (
    public.has_capability('access_professional_services')
    and (created_by = auth.uid() or public.is_admin())
  );

drop policy if exists professional_service_practitioners_delete
  on public.professional_service_practitioners;
create policy professional_service_practitioners_delete
  on public.professional_service_practitioners for delete
  to authenticated
  using (
    public.has_capability('access_professional_services')
    and (created_by = auth.uid() or public.is_admin())
  );

grant select, insert, update, delete on public.professional_service_practitioners to authenticated;
grant all on public.professional_service_practitioners to service_role;
