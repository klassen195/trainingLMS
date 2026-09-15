-- Allow shift plan items to be marked complete.

alter table public.shift_plan_items
  add column if not exists completed boolean not null default false,
  add column if not exists completed_at timestamptz;

create index if not exists shift_plan_items_completed_idx
  on public.shift_plan_items (client_id, shift_date, completed);
