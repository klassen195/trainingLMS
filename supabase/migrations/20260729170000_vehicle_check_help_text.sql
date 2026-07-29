-- Optional help text on vehicle check template checklist items

alter table public.vehicle_check_template_items
  add column if not exists help_text text not null default '';
