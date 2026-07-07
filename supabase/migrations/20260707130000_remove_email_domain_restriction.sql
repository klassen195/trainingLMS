-- Remove @kootenaifire.com-only sign-up restriction.
drop trigger if exists enforce_kootenaifire_email on auth.users;
drop function if exists public.enforce_kootenaifire_email();
