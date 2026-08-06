-- Swing-up qualification: highest rank the member is cleared to work above their promoted rank.

alter table public.profiles
  add column if not exists swing_up text;

comment on column public.profiles.swing_up is
  'Rank the member is qualified to work at above their current promoted rank (acting / swing-up).';
