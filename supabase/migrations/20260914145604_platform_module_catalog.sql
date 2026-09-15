-- Global master module order (platform-wide). Per-client order stays in client_modules.

create table if not exists public.platform_module_catalog (
  module_key text primary key,
  sort_order integer not null default 0,
  constraint platform_module_catalog_module_key_check check (
    module_key in (
      'access_shift_exchange',
      'access_shift_plan',
      'access_professional_services',
      'access_programs',
      'access_assets',
      'view_fleet',
      'manage_incidents',
      'access_personnel',
      'document_training',
      'approval_tracker',
      'author_training'
    )
  )
);

alter table public.platform_module_catalog enable row level security;

drop policy if exists "platform_module_catalog_select_authenticated" on public.platform_module_catalog;
create policy "platform_module_catalog_select_authenticated"
  on public.platform_module_catalog for select
  to authenticated
  using (true);

drop policy if exists "platform_module_catalog_mutate_platform_admin" on public.platform_module_catalog;
create policy "platform_module_catalog_mutate_platform_admin"
  on public.platform_module_catalog for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select, insert, update, delete on public.platform_module_catalog to authenticated;
grant all on public.platform_module_catalog to service_role;

insert into public.platform_module_catalog (module_key, sort_order)
values
  ('access_shift_exchange', 1),
  ('access_shift_plan', 2),
  ('access_professional_services', 3),
  ('access_programs', 4),
  ('access_assets', 5),
  ('view_fleet', 6),
  ('manage_incidents', 7),
  ('access_personnel', 8),
  ('document_training', 9),
  ('approval_tracker', 10),
  ('author_training', 11)
on conflict (module_key) do nothing;

-- New clients inherit enablement + order from the master catalog.
create or replace function public.seed_client_modules(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' and not public.is_platform_admin() then
    raise exception 'Only platform admins can seed client modules';
  end if;

  insert into public.client_modules (client_id, module_key, enabled, sort_order)
  select
    p_client_id,
    c.module_key,
    true,
    c.sort_order
  from public.platform_module_catalog c
  order by c.sort_order, c.module_key
  on conflict (client_id, module_key) do nothing;

  -- Ensure any catalog gaps still get hardcoded defaults.
  insert into public.client_modules (client_id, module_key, enabled, sort_order)
  values
    (p_client_id, 'access_shift_exchange', true, 1),
    (p_client_id, 'access_shift_plan', true, 2),
    (p_client_id, 'access_professional_services', true, 3),
    (p_client_id, 'access_programs', true, 4),
    (p_client_id, 'access_assets', true, 5),
    (p_client_id, 'view_fleet', true, 6),
    (p_client_id, 'manage_incidents', true, 7),
    (p_client_id, 'access_personnel', true, 8),
    (p_client_id, 'document_training', true, 9),
    (p_client_id, 'approval_tracker', true, 10),
    (p_client_id, 'author_training', true, 11)
  on conflict (client_id, module_key) do nothing;
end;
$$;
