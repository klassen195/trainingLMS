-- Schema + open RLS policies for shift exchange requests

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'shift_exchange_category') then
    create type public.shift_exchange_category as enum (
      'station',
      'engine',
      'boat',
      'tech_rescue',
      'events',
      'ems'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'shift_color') then
    create type public.shift_color as enum (
      'Red',
      'Green',
      'Blue'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'shift_exchange_status') then
    create type public.shift_exchange_status as enum (
      'open',
      'resolved'
    );
  end if;
end $$;

-- Add ems if the enum already existed without it (no-op when created above with ems)
alter type public.shift_exchange_category add value if not exists 'ems';

create table if not exists public.shift_exchange_requests (
  id uuid primary key default gen_random_uuid(),
  created_by uuid null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),

  category public.shift_exchange_category not null,
  shift_color public.shift_color not null,
  shift_date date not null,
  station_or_unit text not null,
  request_notes text not null default '',

  status public.shift_exchange_status not null default 'open',
  resolved_at timestamptz null,
  resolved_by uuid null references auth.users (id) on delete set null,
  resolved_note text null
);

alter table public.shift_exchange_requests enable row level security;

create or replace function public.shift_exchange_set_resolved_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'UPDATE') and (old.status = 'open') and (new.status = 'resolved') then
    new.resolved_at := now();
    new.resolved_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists shift_exchange_set_resolved_metadata on public.shift_exchange_requests;
create trigger shift_exchange_set_resolved_metadata
before update on public.shift_exchange_requests
for each row
execute function public.shift_exchange_set_resolved_metadata();

drop policy if exists "shift_exchange_select_authenticated" on public.shift_exchange_requests;
drop policy if exists "shift_exchange_insert_authenticated" on public.shift_exchange_requests;
drop policy if exists "shift_exchange_resolve_authenticated" on public.shift_exchange_requests;
drop policy if exists "shift_exchange_select_open" on public.shift_exchange_requests;
drop policy if exists "shift_exchange_insert_open" on public.shift_exchange_requests;
drop policy if exists "shift_exchange_resolve_open" on public.shift_exchange_requests;

create policy "shift_exchange_select_open"
on public.shift_exchange_requests
for select
to anon, authenticated
using (true);

create policy "shift_exchange_insert_open"
on public.shift_exchange_requests
for insert
to anon, authenticated
with check (true);

create policy "shift_exchange_resolve_open"
on public.shift_exchange_requests
for update
to anon, authenticated
using (status = 'open')
with check (
  status = 'resolved'
);
