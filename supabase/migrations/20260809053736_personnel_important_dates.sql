-- Important family dates on personnel demographics

alter table public.profiles
  add column if not exists anniversary date,
  add column if not exists spouse_birthday date,
  add column if not exists kids_birthdays text;

comment on column public.profiles.anniversary is
  'Wedding / anniversary date for personnel demographics';
comment on column public.profiles.spouse_birthday is
  'Spouse birthday for personnel demographics';
comment on column public.profiles.kids_birthdays is
  'Kids birthdays (freeform; name and date per line)';
