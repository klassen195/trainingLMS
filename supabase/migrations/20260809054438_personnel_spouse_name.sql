-- Spouse name for personnel family demographics

alter table public.profiles
  add column if not exists spouse_name text;

comment on column public.profiles.spouse_name is
  'Spouse / partner name for personnel family demographics';
