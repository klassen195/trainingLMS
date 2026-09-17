-- Optional per-day categories for multi-day certification courses (e.g. conferences)

alter table public.training_sessions
  add column if not exists category_by_day boolean not null default false;

alter table public.training_session_days
  add column if not exists category_id uuid null
    references public.training_categories (id) on delete restrict;

create index if not exists training_session_days_category_id_idx
  on public.training_session_days (category_id);
