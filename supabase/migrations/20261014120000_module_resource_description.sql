-- Optional learner-facing description for course resources.

alter table public.module_resources
  add column if not exists description text;
