-- Training authorization level stamp shown on upcoming training listings (I–IV).
alter table public.upcoming_trainings
  add column if not exists authorization_level text;

alter table public.upcoming_trainings
  drop constraint if exists upcoming_trainings_authorization_level_check;

alter table public.upcoming_trainings
  add constraint upcoming_trainings_authorization_level_check
  check (
    authorization_level is null
    or authorization_level in ('I', 'II', 'III', 'IV')
  );

comment on column public.upcoming_trainings.authorization_level is
  'Training authorization badge level (I–IV); null when not set.';
