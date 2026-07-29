-- Upgrade vehicle check templates to unified list with section breaks
-- Safe to run if 20260729140000 already applied with the older shape.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'vehicle_check_template_row_kind') then
    create type public.vehicle_check_template_row_kind as enum ('section', 'item');
  end if;
end $$;

alter table public.vehicle_check_template_items
  add column if not exists row_kind public.vehicle_check_template_row_kind;

update public.vehicle_check_template_items
set row_kind = 'item'
where row_kind is null;

alter table public.vehicle_check_template_items
  alter column row_kind set default 'item';

alter table public.vehicle_check_template_items
  alter column row_kind set not null;

alter table public.vehicle_check_template_items
  alter column check_type drop not null;

alter table public.vehicle_check_template_items
  drop constraint if exists vehicle_check_template_items_kind_check;

alter table public.vehicle_check_template_items
  add constraint vehicle_check_template_items_kind_check check (
    (row_kind = 'section' and check_type is null)
    or (row_kind = 'item' and check_type is not null)
  );

drop index if exists public.vehicle_check_template_items_type_sort_idx;

create index if not exists vehicle_check_template_items_sort_idx
  on public.vehicle_check_template_items (sort_order);

alter table public.vehicle_check_responses
  add column if not exists section_title text null;
