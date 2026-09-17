-- Optional presenter name per certification course session

alter table public.training_session_days
  add column if not exists presenter text null;
