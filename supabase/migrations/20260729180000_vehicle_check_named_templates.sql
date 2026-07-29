-- Named vehicle-check templates with per-unit override

create table if not exists public.vehicle_check_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  apparatus_type public.apparatus_type null,
  is_type_default boolean not null default false,
  notes text not null default '',
  constraint vehicle_check_templates_name_check check (char_length(trim(name)) > 0),
  constraint vehicle_check_templates_default_requires_type check (
    not is_type_default or apparatus_type is not null
  )
);

create unique index if not exists vehicle_check_templates_type_default_uidx
  on public.vehicle_check_templates (apparatus_type)
  where is_type_default and apparatus_type is not null;

create index if not exists vehicle_check_templates_apparatus_type_idx
  on public.vehicle_check_templates (apparatus_type);

create or replace function public.set_vehicle_check_templates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vehicle_check_templates_updated_at on public.vehicle_check_templates;
create trigger vehicle_check_templates_updated_at
  before update on public.vehicle_check_templates
  for each row execute function public.set_vehicle_check_templates_updated_at();

-- Backfill a default template and attach existing items
insert into public.vehicle_check_templates (id, name, notes)
select
  gen_random_uuid(),
  'Default checklist',
  'Migrated from the previous global checklist. Set type defaults and unit overrides as needed.'
where not exists (
  select 1 from public.vehicle_check_templates where name = 'Default checklist'
);

alter table public.vehicle_check_template_items
  add column if not exists template_id uuid null references public.vehicle_check_templates (id) on delete cascade;

update public.vehicle_check_template_items
set template_id = (
  select id from public.vehicle_check_templates where name = 'Default checklist' limit 1
)
where template_id is null;

alter table public.vehicle_check_template_items
  alter column template_id set not null;

create index if not exists vehicle_check_template_items_template_id_idx
  on public.vehicle_check_template_items (template_id, sort_order);

alter table public.assets
  add column if not exists vehicle_check_template_id uuid null
    references public.vehicle_check_templates (id) on delete set null;

create index if not exists assets_vehicle_check_template_id_idx
  on public.assets (vehicle_check_template_id);

alter table public.vehicle_check_templates enable row level security;

drop policy if exists "vehicle_check_templates_select" on public.vehicle_check_templates;
drop policy if exists "vehicle_check_templates_insert_admin" on public.vehicle_check_templates;
drop policy if exists "vehicle_check_templates_update_admin" on public.vehicle_check_templates;
drop policy if exists "vehicle_check_templates_delete_admin" on public.vehicle_check_templates;

create policy "vehicle_check_templates_select"
  on public.vehicle_check_templates for select
  to authenticated
  using (true);

create policy "vehicle_check_templates_insert_admin"
  on public.vehicle_check_templates for insert
  to authenticated
  with check (public.is_admin());

create policy "vehicle_check_templates_update_admin"
  on public.vehicle_check_templates for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "vehicle_check_templates_delete_admin"
  on public.vehicle_check_templates for delete
  to authenticated
  using (public.is_admin());
