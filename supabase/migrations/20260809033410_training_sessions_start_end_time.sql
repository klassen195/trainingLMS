-- Add start/end times to document training reports (in-house sessions)

alter table public.training_sessions
  add column if not exists start_time time,
  add column if not exists end_time time;

alter table public.training_sessions
  drop constraint if exists training_sessions_time_order;

alter table public.training_sessions
  add constraint training_sessions_time_order check (
    start_time is null
    or end_time is null
    or end_time > start_time
  );
