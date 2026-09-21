-- PDIP eligibility on taskbook catalog (which completed taskbooks count on PDIP).

alter table public.taskbook_types
  add column if not exists pdip_eligible boolean not null default false;
