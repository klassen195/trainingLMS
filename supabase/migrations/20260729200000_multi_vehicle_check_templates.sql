-- Multiple checklists per unit: frequency flag, multi type-defaults, junction table

alter table public.vehicle_check_templates
  add column if not exists uses_daily_weekly boolean not null default true;

drop index if exists public.vehicle_check_templates_type_default_uidx;

create table if not exists public.asset_vehicle_check_templates (
  asset_id uuid not null references public.assets (id) on delete cascade,
  template_id uuid not null references public.vehicle_check_templates (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (asset_id, template_id)
);

create index if not exists asset_vehicle_check_templates_template_id_idx
  on public.asset_vehicle_check_templates (template_id);

create index if not exists asset_vehicle_check_templates_asset_sort_idx
  on public.asset_vehicle_check_templates (asset_id, sort_order);

-- Backfill from previous single override column
insert into public.asset_vehicle_check_templates (asset_id, template_id, sort_order)
select a.id, a.vehicle_check_template_id, 0
from public.assets a
where a.vehicle_check_template_id is not null
on conflict (asset_id, template_id) do nothing;

alter table public.assets
  drop column if exists vehicle_check_template_id;

alter table public.vehicle_checks
  add column if not exists template_id uuid null
    references public.vehicle_check_templates (id) on delete set null;

create index if not exists vehicle_checks_template_id_idx
  on public.vehicle_checks (template_id);

-- Allow one-shot checks (neither daily nor weekly)
alter table public.vehicle_checks
  drop constraint if exists vehicle_checks_includes_check;

-- Allow null check_type on responses for one-shot items
alter table public.vehicle_check_responses
  alter column check_type drop not null;

-- Allow item rows without check_type (one-shot templates)
alter table public.vehicle_check_template_items
  drop constraint if exists vehicle_check_template_items_kind_check;

alter table public.vehicle_check_template_items
  add constraint vehicle_check_template_items_kind_check check (
    (row_kind = 'section' and check_type is null and field_type is null)
    or (row_kind = 'item' and field_type is not null)
  );

alter table public.asset_vehicle_check_templates enable row level security;

drop policy if exists "asset_vehicle_check_templates_select" on public.asset_vehicle_check_templates;
drop policy if exists "asset_vehicle_check_templates_insert_admin" on public.asset_vehicle_check_templates;
drop policy if exists "asset_vehicle_check_templates_update_admin" on public.asset_vehicle_check_templates;
drop policy if exists "asset_vehicle_check_templates_delete_admin" on public.asset_vehicle_check_templates;

create policy "asset_vehicle_check_templates_select"
  on public.asset_vehicle_check_templates for select
  to authenticated
  using (true);

create policy "asset_vehicle_check_templates_insert_admin"
  on public.asset_vehicle_check_templates for insert
  to authenticated
  with check (public.is_admin());

create policy "asset_vehicle_check_templates_update_admin"
  on public.asset_vehicle_check_templates for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "asset_vehicle_check_templates_delete_admin"
  on public.asset_vehicle_check_templates for delete
  to authenticated
  using (public.is_admin());
