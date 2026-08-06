-- Admin-editable training categories for Document Training sessions

create table if not exists public.training_categories (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  notes text not null default '',
  constraint training_categories_name_unique unique (name),
  constraint training_categories_name_not_blank check (length(trim(name)) > 0)
);

create index if not exists training_categories_sort_order_idx
  on public.training_categories (sort_order, name);
create index if not exists training_categories_is_active_idx
  on public.training_categories (is_active);

create or replace function public.set_training_categories_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists training_categories_updated_at on public.training_categories;
create trigger training_categories_updated_at
  before update on public.training_categories
  for each row
  execute function public.set_training_categories_updated_at();

insert into public.training_categories (name, sort_order)
values
  ('Administration', 1),
  ('EMS', 2),
  ('Fire', 3),
  ('Driver', 4),
  ('Officer', 5),
  ('Special Operations', 6)
on conflict (name) do nothing;

alter table public.training_categories enable row level security;

drop policy if exists "training_categories_select_authenticated" on public.training_categories;
create policy "training_categories_select_authenticated"
  on public.training_categories for select
  to authenticated
  using (true);

drop policy if exists "training_categories_insert_admin" on public.training_categories;
create policy "training_categories_insert_admin"
  on public.training_categories for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "training_categories_update_admin" on public.training_categories;
create policy "training_categories_update_admin"
  on public.training_categories for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "training_categories_delete_admin" on public.training_categories;
create policy "training_categories_delete_admin"
  on public.training_categories for delete
  to authenticated
  using (public.is_admin());

-- Attach category to documented training sessions
alter table public.training_sessions
  add column if not exists category_id uuid references public.training_categories (id) on delete restrict;

-- Backfill any existing rows to Fire (or first available) before enforcing NOT NULL
update public.training_sessions s
set category_id = c.id
from public.training_categories c
where s.category_id is null
  and c.name = 'Fire';

update public.training_sessions s
set category_id = (
  select id from public.training_categories order by sort_order, name limit 1
)
where s.category_id is null;

alter table public.training_sessions
  alter column category_id set not null;

create index if not exists training_sessions_category_id_idx
  on public.training_sessions (category_id);
