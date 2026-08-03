-- Equipment categories (admin-managed) + expanded PPE/equipment fields on assets

create extension if not exists pgcrypto;

create table if not exists public.equipment_categories (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  notes text not null default '',
  constraint equipment_categories_name_unique unique (name),
  constraint equipment_categories_name_not_blank check (length(trim(name)) > 0)
);

create index if not exists equipment_categories_sort_order_idx
  on public.equipment_categories (sort_order, name);
create index if not exists equipment_categories_is_active_idx
  on public.equipment_categories (is_active);

create or replace function public.set_equipment_categories_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists equipment_categories_updated_at on public.equipment_categories;
create trigger equipment_categories_updated_at
  before update on public.equipment_categories
  for each row execute function public.set_equipment_categories_updated_at();

insert into public.equipment_categories (name, sort_order)
values
  ('Turnout coat', 1),
  ('Turnout pants', 2),
  ('Helmet', 3),
  ('Boots', 4),
  ('Gloves', 5),
  ('Hood', 6),
  ('SCBA facepiece', 7),
  ('Other', 8)
on conflict (name) do nothing;

alter table public.assets
  add column if not exists equipment_category_id uuid null
    references public.equipment_categories (id) on delete restrict,
  add column if not exists subcategory text null,
  add column if not exists description text null,
  add column if not exists purchase_cost numeric(12, 2) null,
  add column if not exists in_service_on date null;

create index if not exists assets_equipment_category_id_idx
  on public.assets (equipment_category_id);

-- Backfill category FK from legacy ppe_category enum
update public.assets a
set equipment_category_id = c.id
from public.equipment_categories c
where a.kind = 'ppe'
  and a.equipment_category_id is null
  and a.ppe_category is not null
  and c.name = case a.ppe_category::text
    when 'turnout_coat' then 'Turnout coat'
    when 'turnout_pants' then 'Turnout pants'
    when 'helmet' then 'Helmet'
    when 'boots' then 'Boots'
    when 'gloves' then 'Gloves'
    when 'hood' then 'Hood'
    when 'scba_facepiece' then 'SCBA facepiece'
    when 'other' then 'Other'
    else null
  end;

-- Any remaining PPE without a mapped category lands on Other
update public.assets a
set equipment_category_id = c.id
from public.equipment_categories c
where a.kind = 'ppe'
  and a.equipment_category_id is null
  and c.name = 'Other';

alter table public.assets drop constraint if exists assets_ppe_category_check;
alter table public.assets drop constraint if exists assets_equipment_category_check;

alter table public.assets
  add constraint assets_equipment_category_check check (
    (kind = 'ppe' and equipment_category_id is not null)
    or (kind = 'apparatus' and equipment_category_id is null)
  );

alter table public.equipment_categories enable row level security;

drop policy if exists "equipment_categories_select_authenticated" on public.equipment_categories;
drop policy if exists "equipment_categories_insert_manage" on public.equipment_categories;
drop policy if exists "equipment_categories_update_manage" on public.equipment_categories;
drop policy if exists "equipment_categories_delete_manage" on public.equipment_categories;

create policy "equipment_categories_select_authenticated"
  on public.equipment_categories for select
  to authenticated
  using (true);

create policy "equipment_categories_insert_manage"
  on public.equipment_categories for insert
  to authenticated
  with check (public.has_capability('manage_assets'));

create policy "equipment_categories_update_manage"
  on public.equipment_categories for update
  to authenticated
  using (public.has_capability('manage_assets'))
  with check (public.has_capability('manage_assets'));

create policy "equipment_categories_delete_manage"
  on public.equipment_categories for delete
  to authenticated
  using (public.has_capability('manage_assets'));
