-- Opt locations into the Shift Plan module independently of inventory assignment.

alter table public.locations
  add column if not exists include_in_shift_plan boolean not null default true;

comment on column public.locations.include_in_shift_plan is
  'When true, this location appears as a station on the Shift Plan.';
