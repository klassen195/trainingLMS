-- Split personnel names into first_name / last_name while keeping display_name in sync.

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text;

-- Backfill from existing display_name: first word → first_name, remainder → last_name
update public.profiles
set
  first_name = nullif(btrim(split_part(btrim(display_name), ' ', 1)), ''),
  last_name = nullif(
    btrim(
      substring(
        btrim(display_name)
        from length(split_part(btrim(display_name), ' ', 1)) + 1
      )
    ),
    ''
  )
where display_name is not null
  and btrim(display_name) <> ''
  and first_name is null
  and last_name is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_first text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), '');
  meta_last text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), '');
  meta_display text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  composed text;
begin
  if meta_first is null and meta_last is null and meta_display is not null then
    meta_first := nullif(btrim(split_part(meta_display, ' ', 1)), '');
    meta_last := nullif(
      btrim(substring(meta_display from length(split_part(meta_display, ' ', 1)) + 1)),
      ''
    );
  end if;

  composed := nullif(btrim(concat_ws(' ', meta_first, meta_last)), '');
  if composed is null then
    composed := coalesce(meta_display, split_part(new.email, '@', 1));
  end if;

  insert into public.profiles (id, display_name, first_name, last_name, email)
  values (new.id, composed, meta_first, meta_last, new.email);
  return new;
end;
$$;
