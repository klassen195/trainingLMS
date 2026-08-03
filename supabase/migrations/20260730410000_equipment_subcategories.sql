-- Admin-managed equipment subcategories (belong to a parent category)

create extension if not exists pgcrypto;

create table if not exists public.equipment_subcategories (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  equipment_category_id uuid not null
    references public.equipment_categories (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  notes text not null default '',
  constraint equipment_subcategories_name_not_blank check (length(trim(name)) > 0),
  constraint equipment_subcategories_category_name_unique unique (equipment_category_id, name)
);

create index if not exists equipment_subcategories_category_idx
  on public.equipment_subcategories (equipment_category_id, sort_order, name);
create index if not exists equipment_subcategories_is_active_idx
  on public.equipment_subcategories (is_active);

create or replace function public.set_equipment_subcategories_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists equipment_subcategories_updated_at on public.equipment_subcategories;
create trigger equipment_subcategories_updated_at
  before update on public.equipment_subcategories
  for each row execute function public.set_equipment_subcategories_updated_at();

alter table public.assets
  add column if not exists equipment_subcategory_id uuid null
    references public.equipment_subcategories (id) on delete set null;

create index if not exists assets_equipment_subcategory_id_idx
  on public.assets (equipment_subcategory_id);

-- Create subcategories from existing free-text values, scoped to each asset's category
insert into public.equipment_subcategories (equipment_category_id, name, sort_order)
select distinct
  a.equipment_category_id,
  trim(a.subcategory),
  1
from public.assets a
where a.kind = 'ppe'
  and a.equipment_category_id is not null
  and a.subcategory is not null
  and length(trim(a.subcategory)) > 0
on conflict (equipment_category_id, name) do nothing;

update public.assets a
set equipment_subcategory_id = s.id
from public.equipment_subcategories s
where a.kind = 'ppe'
  and a.equipment_subcategory_id is null
  and a.equipment_category_id = s.equipment_category_id
  and a.subcategory is not null
  and trim(a.subcategory) = s.name;

alter table public.equipment_subcategories enable row level security;

drop policy if exists "equipment_subcategories_select_authenticated" on public.equipment_subcategories;
drop policy if exists "equipment_subcategories_insert_manage" on public.equipment_subcategories;
drop policy if exists "equipment_subcategories_update_manage" on public.equipment_subcategories;
drop policy if exists "equipment_subcategories_delete_manage" on public.equipment_subcategories;

create policy "equipment_subcategories_select_authenticated"
  on public.equipment_subcategories for select
  to authenticated
  using (true);

create policy "equipment_subcategories_insert_manage"
  on public.equipment_subcategories for insert
  to authenticated
  with check (public.has_capability('manage_assets'));

create policy "equipment_subcategories_update_manage"
  on public.equipment_subcategories for update
  to authenticated
  using (public.has_capability('manage_assets'))
  with check (public.has_capability('manage_assets'));

create policy "equipment_subcategories_delete_manage"
  on public.equipment_subcategories for delete
  to authenticated
  using (public.has_capability('manage_assets'));
