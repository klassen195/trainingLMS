-- Allow all authenticated users to read profiles for the department directory.
-- Person-file UI still gates full detail to self / admin / supervisor in the app.

drop policy if exists "profiles_select_own_admin_or_supervisor" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);
