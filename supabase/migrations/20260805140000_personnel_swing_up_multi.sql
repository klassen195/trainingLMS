-- Allow multiple swing-up ranks per person.

alter table public.profiles
  alter column swing_up type text[]
  using case
    when swing_up is null or btrim(swing_up) = '' then '{}'::text[]
    else array[btrim(swing_up)]
  end;

alter table public.profiles
  alter column swing_up set default '{}'::text[];

update public.profiles
set swing_up = '{}'::text[]
where swing_up is null;

alter table public.profiles
  alter column swing_up set not null;

comment on column public.profiles.swing_up is
  'Ranks the member is qualified to work at above their current promoted rank (acting / swing-up).';
