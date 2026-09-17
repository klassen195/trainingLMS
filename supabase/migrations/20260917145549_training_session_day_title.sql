-- Optional display title for each certification course session

alter table public.training_session_days
  add column if not exists title text null;
