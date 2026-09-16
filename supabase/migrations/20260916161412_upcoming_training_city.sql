-- Separate city field for upcoming training announcements.
alter table public.upcoming_trainings
  add column if not exists city text not null default '';

comment on column public.upcoming_trainings.city is
  'City for the training opportunity, separate from venue/location.';
