-- Restrict sign-ups to @kootenaifire.com addresses.
create or replace function public.enforce_kootenaifire_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null or lower(split_part(new.email, '@', 2)) <> 'kootenaifire.com' then
    raise exception 'Only @kootenaifire.com email addresses are allowed';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_kootenaifire_email on auth.users;

create trigger enforce_kootenaifire_email
  before insert on auth.users
  for each row execute function public.enforce_kootenaifire_email();
