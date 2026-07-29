-- Checklist type: check (daily/weekly + pass/fail) vs swap (moved status, no frequency)

do $$
begin
  if not exists (select 1 from pg_type where typname = 'vehicle_checklist_kind') then
    create type public.vehicle_checklist_kind as enum ('check', 'swap');
  end if;
end $$;

alter table public.vehicle_check_templates
  add column if not exists checklist_kind public.vehicle_checklist_kind null;

update public.vehicle_check_templates
set checklist_kind = case
  when uses_daily_weekly then 'check'::public.vehicle_checklist_kind
  else 'swap'::public.vehicle_checklist_kind
end
where checklist_kind is null;

alter table public.vehicle_check_templates
  alter column checklist_kind set default 'check';

alter table public.vehicle_check_templates
  alter column checklist_kind set not null;

alter table public.vehicle_check_templates
  drop column if exists uses_daily_weekly;
