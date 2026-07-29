-- Department locations (stations and other sites) for inventory assignment

create extension if not exists pgcrypto;

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  notes text not null default '',
  constraint locations_name_unique unique (name),
  constraint locations_name_not_blank check (length(trim(name)) > 0)
);

create index if not exists locations_sort_order_idx on public.locations (sort_order, name);
create index if not exists locations_is_active_idx on public.locations (is_active);

create or replace function public.set_locations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists locations_updated_at on public.locations;
create trigger locations_updated_at
  before update on public.locations
  for each row execute function public.set_locations_updated_at();

insert into public.locations (name, sort_order)
values
  ('Station 1', 1),
  ('Station 2', 2),
  ('Station 3', 3),
  ('Station 4', 4),
  ('Station 5', 5)
on conflict (name) do nothing;

alter table public.locations enable row level security;

drop policy if exists "locations_select_authenticated" on public.locations;
drop policy if exists "locations_insert_admin" on public.locations;
drop policy if exists "locations_update_admin" on public.locations;
drop policy if exists "locations_delete_admin" on public.locations;

create policy "locations_select_authenticated"
  on public.locations for select
  to authenticated
  using (true);

create policy "locations_insert_admin"
  on public.locations for insert
  to authenticated
  with check (public.is_admin());

create policy "locations_update_admin"
  on public.locations for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "locations_delete_admin"
  on public.locations for delete
  to authenticated
  using (public.is_admin());
