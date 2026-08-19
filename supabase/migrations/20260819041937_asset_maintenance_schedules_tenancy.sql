-- Silo fleet PM schedules after multi-client tenancy. No-op if the table
-- is missing or already has client_id.

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'asset_maintenance_schedules'
  ) then
    return;
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'clients'
  ) then
    return;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'asset_maintenance_schedules'
      and column_name = 'client_id'
  ) then
    alter table public.asset_maintenance_schedules
      add column client_id uuid references public.clients (id);

    update public.asset_maintenance_schedules s
    set client_id = a.client_id
    from public.assets a
    where a.id = s.asset_id
      and s.client_id is null;

    update public.asset_maintenance_schedules
    set client_id = 'a0000000-0000-4000-8000-000000000001'::uuid
    where client_id is null;

    alter table public.asset_maintenance_schedules
      alter column client_id set not null;
  end if;

  execute 'create index if not exists asset_maintenance_schedules_client_id_idx on public.asset_maintenance_schedules (client_id)';
  execute 'drop trigger if exists set_client_id_default on public.asset_maintenance_schedules';
  execute 'create trigger set_client_id_default before insert on public.asset_maintenance_schedules for each row execute function public.set_row_client_id()';
  execute 'drop policy if exists tenant_isolation on public.asset_maintenance_schedules';
  execute 'create policy tenant_isolation on public.asset_maintenance_schedules as restrictive for all to authenticated using (client_id = public.current_client_id()) with check (client_id = public.current_client_id())';
end $$;
