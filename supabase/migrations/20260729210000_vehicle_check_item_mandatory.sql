-- Optional vs mandatory checklist items

alter table public.vehicle_check_template_items
  add column if not exists is_mandatory boolean not null default false;
