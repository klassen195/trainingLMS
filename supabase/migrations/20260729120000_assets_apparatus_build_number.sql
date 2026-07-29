-- Add build_number for apparatus assets

alter table public.assets
  add column if not exists build_number text null;
