-- Allow multiple sessions on the same calendar date (non-overlapping times enforced in app)

alter table public.training_session_days
  drop constraint if exists training_session_days_unique_date;
