-- Per-client feature module enablement and main-nav order (platform admin).

create table if not exists public.client_modules (
  client_id uuid not null references public.clients (id) on delete cascade,
  module_key text not null,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  primary key (client_id, module_key),
  constraint client_modules_module_key_check check (
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

create index if not exists client_modules_client_sort_idx
  on public.client_modules (client_id, sort_order, module_key);

alter table public.client_modules enable row level security;

drop policy if exists "client_modules_select_own_or_platform" on public.client_modules;
create policy "client_modules_select_own_or_platform"
  on public.client_modules for select
  to authenticated
  using (client_id = public.current_client_id() or public.is_platform_admin());

drop policy if exists "client_modules_mutate_platform_admin" on public.client_modules;
create policy "client_modules_mutate_platform_admin"
  on public.client_modules for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select, insert, update, delete on public.client_modules to authenticated;
grant all on public.client_modules to service_role;

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

revoke all on function public.seed_client_modules(uuid) from public;
grant execute on function public.seed_client_modules(uuid) to service_role, authenticated;

-- Seed every existing client with default modules (all enabled, default order).
insert into public.client_modules (client_id, module_key, enabled, sort_order)
select
  c.id,
  m.module_key,
  true,
  m.sort_order
from public.clients c
cross join (
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
) as m(module_key, sort_order)
on conflict (client_id, module_key) do nothing;

-- Gate capabilities by client module enablement (missing row = enabled).
create or replace function public.has_capability(p_capability text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and not exists (
        select 1
        from public.client_modules cm
        where cm.client_id = public.current_client_id()
          and cm.module_key = p_capability
          and cm.enabled = false
      )
      and (
        public.is_platform_admin()
        or p.is_admin = true
        or exists (
          select 1
          from public.profile_permission_levels ppl
          join public.permission_level_capabilities c
            on c.permission_level_id = ppl.permission_level_id
           and c.client_id = ppl.client_id
          where ppl.profile_id = p.id
            and c.capability = p_capability
            and c.enabled = true
        )
      )
  );
$$;

-- Also seed modules when permission defaults are seeded for a new client.
create or replace function public.seed_client_permission_defaults(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' and not public.is_platform_admin() then
    raise exception 'Only platform admins can seed client permissions';
  end if;

  perform public.seed_client_modules(p_client_id);

  if exists (select 1 from public.permission_levels where client_id = p_client_id) then
    return;
  end if;

  insert into public.permission_levels (client_id, name, sort_order, is_default)
  values
    (p_client_id, 'Recruit', 1, false),
    (p_client_id, 'Firefighter', 2, false),
    (p_client_id, 'Captain', 3, false);

  update public.permission_levels
  set is_default = true
  where client_id = p_client_id
    and name = 'Firefighter';

  update public.permission_level_capabilities c
  set enabled = true
  from public.permission_levels pl
  where c.permission_level_id = pl.id
    and pl.client_id = p_client_id
    and (
      (pl.name = 'Recruit' and c.capability in ('submit_vehicle_checks', 'submit_maintenance'))
      or (
        pl.name = 'Firefighter'
        and c.capability in (
          'browse_program_catalog',
          'self_enroll',
          'document_training',
          'view_apparatus',
          'submit_vehicle_checks',
          'submit_maintenance'
        )
      )
      or (
        pl.name = 'Captain'
        and c.capability in (
          'browse_program_catalog',
          'self_enroll',
          'author_training',
          'ems_qi',
          'document_training',
          'view_apparatus',
          'submit_vehicle_checks',
          'submit_maintenance',
          'manage_incidents'
        )
      )
    );
end;
$$;
