-- Optional daily start/end times for upcoming training announcements.
alter table public.upcoming_trainings
  add column if not exists start_time time without time zone,
  add column if not exists end_time time without time zone;

comment on column public.upcoming_trainings.start_time is
  'Optional daily start time for the training announcement.';
comment on column public.upcoming_trainings.end_time is
  'Optional daily end time for the training announcement.';
