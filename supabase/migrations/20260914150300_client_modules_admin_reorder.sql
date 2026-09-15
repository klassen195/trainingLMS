-- Allow department admins to reorder their own client_modules.
-- Platform admins keep full control; only platform can change enabled.

drop policy if exists "client_modules_mutate_platform_admin" on public.client_modules;

drop policy if exists "client_modules_insert_platform_admin" on public.client_modules;
create policy "client_modules_insert_platform_admin"
  on public.client_modules for insert
  to authenticated
  with check (public.is_platform_admin());

drop policy if exists "client_modules_update_admin" on public.client_modules;
create policy "client_modules_update_admin"
  on public.client_modules for update
  to authenticated
  using (
    public.is_platform_admin()
    or (public.is_admin() and client_id = public.current_client_id())
  )
  with check (
    public.is_platform_admin()
    or (public.is_admin() and client_id = public.current_client_id())
  );

drop policy if exists "client_modules_delete_platform_admin" on public.client_modules;
create policy "client_modules_delete_platform_admin"
  on public.client_modules for delete
  to authenticated
  using (public.is_platform_admin());

create or replace function public.client_modules_prevent_enabled_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and new.enabled is distinct from old.enabled
    and not public.is_platform_admin()
  then
    raise exception 'Only platform admins can enable or disable client modules';
  end if;
  return new;
end;
$$;

drop trigger if exists client_modules_prevent_enabled_change on public.client_modules;
create trigger client_modules_prevent_enabled_change
  before update on public.client_modules
  for each row
  execute function public.client_modules_prevent_enabled_change();
