-- New checklist items default to optional (mandatory checkbox unchecked)

alter table public.vehicle_check_template_items
  alter column is_mandatory set default false;
