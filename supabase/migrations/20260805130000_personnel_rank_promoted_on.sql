-- Date the member was promoted into their current rank (probation = first year).

alter table public.profiles
  add column if not exists rank_promoted_on date;

comment on column public.profiles.rank_promoted_on is
  'Date promoted into the current rank. On probation through the first year after this date.';
