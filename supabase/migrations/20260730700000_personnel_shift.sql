-- Personnel shift assignment (red / blue / green / white)

do $$
begin
  if not exists (select 1 from pg_type where typname = 'personnel_shift') then
    create type public.personnel_shift as enum (
      'red',
      'blue',
      'green',
      'white'
    );
  end if;
end $$;

alter table public.profiles
  add column if not exists shift public.personnel_shift;

create index if not exists profiles_shift_idx
  on public.profiles (shift);
