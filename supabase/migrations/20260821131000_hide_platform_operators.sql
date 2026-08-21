-- Hide platform operators from department roster queries (select).
-- They can still read their own profile; other operators can still see them.

drop policy if exists hide_platform_operators on public.profiles;
create policy hide_platform_operators on public.profiles
  as restrictive
  for select
  to authenticated
  using (coalesce(is_platform_operator, false) = false);
