-- Per-client display order for capabilities on the permissions admin matrix.

create table if not exists public.capability_display_order (
  client_id uuid not null references public.clients (id) on delete cascade,
  capability text not null,
  sort_order integer not null default 0,
  primary key (client_id, capability),
  constraint capability_display_order_capability_check check (
    capability in (
      'browse_program_catalog',
      'self_enroll',
      'author_training',
      'ems_qi',
      'document_training',
      'delete_training_reports',
      'view_apparatus',
      'view_all_ppe',
      'submit_vehicle_checks',
      'submit_maintenance',
      'manage_assets',
      'manage_locations',
      'manage_vehicle_check_templates',
      'manage_quiz_banks',
      'resolve_maintenance',
      'manage_users',
      'manage_incidents',
      'view_fleet',
      'approval_tracker'
    )
  )
);

create index if not exists capability_display_order_client_sort_idx
  on public.capability_display_order (client_id, sort_order, capability);

drop trigger if exists set_client_id_default on public.capability_display_order;
create trigger set_client_id_default
  before insert on public.capability_display_order
  for each row
  execute function public.set_row_client_id();

alter table public.capability_display_order enable row level security;

drop policy if exists "capability_display_order_select_authenticated" on public.capability_display_order;
create policy "capability_display_order_select_authenticated"
  on public.capability_display_order for select
  to authenticated
  using (true);

drop policy if exists "capability_display_order_insert_admin" on public.capability_display_order;
create policy "capability_display_order_insert_admin"
  on public.capability_display_order for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "capability_display_order_update_admin" on public.capability_display_order;
create policy "capability_display_order_update_admin"
  on public.capability_display_order for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "capability_display_order_delete_admin" on public.capability_display_order;
create policy "capability_display_order_delete_admin"
  on public.capability_display_order for delete
  to authenticated
  using (public.is_admin());

drop policy if exists tenant_isolation on public.capability_display_order;
create policy tenant_isolation
  on public.capability_display_order
  as restrictive
  for all
  to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

grant select, insert, update, delete on public.capability_display_order to authenticated;
grant all on public.capability_display_order to service_role;

-- Seed default order from the current app capability list for every client.
insert into public.capability_display_order (client_id, capability, sort_order)
select
  c.id,
  cap.capability,
  cap.sort_order
from public.clients c
cross join (
  values
    ('browse_program_catalog', 1),
    ('self_enroll', 2),
    ('author_training', 3),
    ('ems_qi', 4),
    ('document_training', 5),
    ('delete_training_reports', 6),
    ('approval_tracker', 7),
    ('view_apparatus', 8),
    ('view_fleet', 9),
    ('view_all_ppe', 10),
    ('submit_vehicle_checks', 11),
    ('submit_maintenance', 12),
    ('manage_incidents', 13),
    ('manage_assets', 14),
    ('manage_locations', 15),
    ('manage_vehicle_check_templates', 16),
    ('manage_quiz_banks', 17),
    ('resolve_maintenance', 18),
    ('manage_users', 19)
) as cap(capability, sort_order)
on conflict (client_id, capability) do nothing;
