-- Upcoming external training listings + attendance request approval workflow.

alter table public.permission_level_capabilities
  drop constraint if exists permission_level_capabilities_capability_check;

alter table public.permission_level_capabilities
  add constraint permission_level_capabilities_capability_check check (
    capability in (
      'access_shift_exchange',
      'access_shift_plan',
      'access_programs',
      'access_assets',
      'access_personnel',
      'browse_program_catalog',
      'self_enroll',
      'author_training',
      'ems_qi',
      'document_training',
      'delete_training_reports',
      'manage_upcoming_training',
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
      'approval_tracker',
      'access_professional_services',
      'access_reports'
    )
  );

alter table public.capability_display_order
  drop constraint if exists capability_display_order_capability_check;

alter table public.capability_display_order
  add constraint capability_display_order_capability_check check (
    capability in (
      'access_shift_exchange',
      'access_shift_plan',
      'access_programs',
      'access_assets',
      'access_personnel',
      'browse_program_catalog',
      'self_enroll',
      'author_training',
      'ems_qi',
      'document_training',
      'delete_training_reports',
      'manage_upcoming_training',
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
      'approval_tracker',
      'access_professional_services',
      'access_reports'
    )
  );

create table if not exists public.upcoming_trainings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  title text not null,
  description text not null default '',
  provider text not null default '',
  location text not null default '',
  starts_on date,
  ends_on date,
  application_deadline date,
  estimated_cost numeric(12, 2),
  external_url text not null default '',
  notes text not null default '',
  status text not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint upcoming_trainings_title_nonempty check (length(trim(title)) > 0),
  constraint upcoming_trainings_status_check check (
    status in ('draft', 'open', 'closed', 'cancelled')
  ),
  constraint upcoming_trainings_date_order check (
    starts_on is null or ends_on is null or ends_on >= starts_on
  )
);

create index if not exists upcoming_trainings_client_status_idx
  on public.upcoming_trainings (client_id, status, starts_on);

create or replace function public.set_upcoming_trainings_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists upcoming_trainings_updated_at on public.upcoming_trainings;
create trigger upcoming_trainings_updated_at
  before update on public.upcoming_trainings
  for each row execute function public.set_upcoming_trainings_updated_at();

drop trigger if exists set_client_id_default on public.upcoming_trainings;
create trigger set_client_id_default
  before insert on public.upcoming_trainings
  for each row execute function public.set_row_client_id();

create table if not exists public.upcoming_training_ops_members (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint upcoming_training_ops_members_unique unique (client_id, profile_id)
);

create index if not exists upcoming_training_ops_members_client_idx
  on public.upcoming_training_ops_members (client_id);
create index if not exists upcoming_training_ops_members_profile_idx
  on public.upcoming_training_ops_members (profile_id);

drop trigger if exists set_client_id_default on public.upcoming_training_ops_members;
create trigger set_client_id_default
  before insert on public.upcoming_training_ops_members
  for each row execute function public.set_row_client_id();

create table if not exists public.training_attendance_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  applicant_id uuid not null references public.profiles (id) on delete restrict,
  upcoming_training_id uuid references public.upcoming_trainings (id) on delete set null,
  title text not null,
  description text not null default '',
  provider text not null default '',
  location text not null default '',
  starts_on date,
  ends_on date,
  estimated_cost numeric(12, 2),
  justification text not null default '',
  current_stage text not null,
  denial_reason text,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_attendance_requests_title_nonempty check (length(trim(title)) > 0),
  constraint training_attendance_requests_stage_check check (
    current_stage in (
      'pending_captain', 'pending_bc', 'pending_ops',
      'approved', 'denied', 'withdrawn'
    )
  ),
  constraint training_attendance_requests_date_order check (
    starts_on is null or ends_on is null or ends_on >= starts_on
  )
);

create index if not exists training_attendance_requests_client_stage_idx
  on public.training_attendance_requests (client_id, current_stage, created_at desc);
create index if not exists training_attendance_requests_applicant_idx
  on public.training_attendance_requests (applicant_id, created_at desc);

create or replace function public.set_training_attendance_requests_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists training_attendance_requests_updated_at on public.training_attendance_requests;
create trigger training_attendance_requests_updated_at
  before update on public.training_attendance_requests
  for each row execute function public.set_training_attendance_requests_updated_at();

drop trigger if exists set_client_id_default on public.training_attendance_requests;
create trigger set_client_id_default
  before insert on public.training_attendance_requests
  for each row execute function public.set_row_client_id();

create table if not exists public.training_attendance_request_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  request_id uuid not null references public.training_attendance_requests (id) on delete cascade,
  from_stage text,
  to_stage text,
  action text not null,
  comment text,
  acted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint training_attendance_request_events_action_check check (
    action in ('created', 'advanced', 'denied', 'withdrawn', 'approved')
  )
);

create index if not exists training_attendance_request_events_request_idx
  on public.training_attendance_request_events (request_id, created_at desc);

drop trigger if exists set_client_id_default on public.training_attendance_request_events;
create trigger set_client_id_default
  before insert on public.training_attendance_request_events
  for each row execute function public.set_row_client_id();

create or replace function public.is_upcoming_training_ops_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.upcoming_training_ops_members m
    where m.profile_id = auth.uid() and m.client_id = public.current_client_id()
  );
$$;

revoke all on function public.is_upcoming_training_ops_member() from public;
grant execute on function public.is_upcoming_training_ops_member() to authenticated, service_role;

create or replace function public.can_view_training_attendance_request(p_request_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  req record;
begin
  if public.is_admin() then return true; end if;

  select r.applicant_id, r.current_stage, r.client_id
  into req from public.training_attendance_requests r where r.id = p_request_id;
  if not found then return false; end if;
  if req.client_id is distinct from public.current_client_id() then return false; end if;
  if req.applicant_id = auth.uid() then return true; end if;
  if public.has_capability('manage_upcoming_training') then return true; end if;

  if req.current_stage = 'pending_captain' and exists (
    select 1 from public.profiles p
    where p.id = req.applicant_id and p.supervisor_id = auth.uid()
  ) then return true; end if;

  if req.current_stage = 'pending_bc' and public.is_battalion_chief_of(req.applicant_id) then
    return true;
  end if;

  if req.current_stage = 'pending_ops' and public.is_upcoming_training_ops_member() then
    return true;
  end if;

  if req.current_stage in ('approved', 'denied', 'withdrawn') then
    if exists (
      select 1 from public.profiles p
      where p.id = req.applicant_id and p.supervisor_id = auth.uid()
    ) then return true; end if;
    if public.is_battalion_chief_of(req.applicant_id) then return true; end if;
    if public.is_upcoming_training_ops_member() then return true; end if;
  end if;

  return false;
end;
$$;

revoke all on function public.can_view_training_attendance_request(uuid) from public;
grant execute on function public.can_view_training_attendance_request(uuid) to authenticated, service_role;

alter table public.upcoming_trainings enable row level security;
drop policy if exists tenant_isolation on public.upcoming_trainings;
create policy tenant_isolation on public.upcoming_trainings
  as restrictive for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

drop policy if exists upcoming_trainings_select on public.upcoming_trainings;
create policy upcoming_trainings_select on public.upcoming_trainings for select to authenticated
  using (
    public.has_capability('document_training')
    and (status = 'open' or public.has_capability('manage_upcoming_training') or public.is_admin())
  );

drop policy if exists upcoming_trainings_insert on public.upcoming_trainings;
create policy upcoming_trainings_insert on public.upcoming_trainings for insert to authenticated
  with check (public.has_capability('manage_upcoming_training') or public.is_admin());

drop policy if exists upcoming_trainings_update on public.upcoming_trainings;
create policy upcoming_trainings_update on public.upcoming_trainings for update to authenticated
  using (public.has_capability('manage_upcoming_training') or public.is_admin())
  with check (public.has_capability('manage_upcoming_training') or public.is_admin());

drop policy if exists upcoming_trainings_delete on public.upcoming_trainings;
create policy upcoming_trainings_delete on public.upcoming_trainings for delete to authenticated
  using (public.has_capability('manage_upcoming_training') or public.is_admin());

alter table public.upcoming_training_ops_members enable row level security;
drop policy if exists tenant_isolation on public.upcoming_training_ops_members;
create policy tenant_isolation on public.upcoming_training_ops_members
  as restrictive for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

drop policy if exists upcoming_training_ops_members_select on public.upcoming_training_ops_members;
create policy upcoming_training_ops_members_select on public.upcoming_training_ops_members
  for select to authenticated
  using (public.is_admin() or profile_id = auth.uid() or public.has_capability('document_training'));

drop policy if exists upcoming_training_ops_members_insert on public.upcoming_training_ops_members;
create policy upcoming_training_ops_members_insert on public.upcoming_training_ops_members
  for insert to authenticated with check (public.is_admin());

drop policy if exists upcoming_training_ops_members_update on public.upcoming_training_ops_members;
create policy upcoming_training_ops_members_update on public.upcoming_training_ops_members
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists upcoming_training_ops_members_delete on public.upcoming_training_ops_members;
create policy upcoming_training_ops_members_delete on public.upcoming_training_ops_members
  for delete to authenticated using (public.is_admin());

alter table public.training_attendance_requests enable row level security;
drop policy if exists tenant_isolation on public.training_attendance_requests;
create policy tenant_isolation on public.training_attendance_requests
  as restrictive for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

drop policy if exists training_attendance_requests_select on public.training_attendance_requests;
create policy training_attendance_requests_select on public.training_attendance_requests
  for select to authenticated
  using (public.has_capability('document_training') and public.can_view_training_attendance_request(id));

drop policy if exists training_attendance_requests_insert on public.training_attendance_requests;
create policy training_attendance_requests_insert on public.training_attendance_requests
  for insert to authenticated
  with check (public.has_capability('document_training') and applicant_id = auth.uid());

drop policy if exists training_attendance_requests_update on public.training_attendance_requests;
create policy training_attendance_requests_update on public.training_attendance_requests
  for update to authenticated
  using (
    public.is_admin()
    or public.has_capability('manage_upcoming_training')
    or (applicant_id = auth.uid() and current_stage in ('pending_captain', 'pending_bc', 'pending_ops'))
    or (current_stage = 'pending_captain' and exists (
      select 1 from public.profiles p
      where p.id = training_attendance_requests.applicant_id and p.supervisor_id = auth.uid()
    ))
    or (current_stage = 'pending_bc' and public.is_battalion_chief_of(applicant_id))
    or (current_stage = 'pending_ops' and public.is_upcoming_training_ops_member())
  )
  with check (
    public.is_admin()
    or public.has_capability('manage_upcoming_training')
    or applicant_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = training_attendance_requests.applicant_id and p.supervisor_id = auth.uid()
    )
    or public.is_battalion_chief_of(applicant_id)
    or public.is_upcoming_training_ops_member()
  );

alter table public.training_attendance_request_events enable row level security;
drop policy if exists tenant_isolation on public.training_attendance_request_events;
create policy tenant_isolation on public.training_attendance_request_events
  as restrictive for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

drop policy if exists training_attendance_request_events_select on public.training_attendance_request_events;
create policy training_attendance_request_events_select on public.training_attendance_request_events
  for select to authenticated
  using (public.has_capability('document_training') and public.can_view_training_attendance_request(request_id));

drop policy if exists training_attendance_request_events_insert on public.training_attendance_request_events;
create policy training_attendance_request_events_insert on public.training_attendance_request_events
  for insert to authenticated
  with check (
    public.has_capability('document_training')
    and (public.is_admin() or public.has_capability('manage_upcoming_training') or acted_by = auth.uid())
  );

grant select, insert, update, delete on public.upcoming_trainings to authenticated;
grant all on public.upcoming_trainings to service_role;
grant select, insert, update, delete on public.upcoming_training_ops_members to authenticated;
grant all on public.upcoming_training_ops_members to service_role;
grant select, insert, update, delete on public.training_attendance_requests to authenticated;
grant all on public.training_attendance_requests to service_role;
grant select, insert on public.training_attendance_request_events to authenticated;
grant all on public.training_attendance_request_events to service_role;

insert into public.permission_level_capabilities (client_id, permission_level_id, capability, enabled)
select pl.client_id, pl.id, 'manage_upcoming_training', false
from public.permission_levels pl
on conflict (permission_level_id, capability) do nothing;

insert into public.capability_display_order (client_id, capability, sort_order, group_name, label)
select c.id, 'manage_upcoming_training', 14, 'Training', 'Manage upcoming training'
from public.clients c
on conflict (client_id, capability) do update
set group_name = excluded.group_name, label = excluded.label;

create or replace function public.permission_levels_seed_capabilities()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.permission_level_capabilities (client_id, permission_level_id, capability, enabled)
  select new.client_id, new.id, cap, cap in (
    'access_shift_exchange', 'access_shift_plan', 'access_professional_services',
    'access_programs', 'access_assets', 'access_personnel', 'access_reports'
  )
  from unnest(array[
    'access_shift_exchange', 'access_shift_plan', 'access_programs', 'access_assets',
    'access_personnel', 'browse_program_catalog', 'self_enroll', 'author_training',
    'ems_qi', 'document_training', 'delete_training_reports', 'manage_upcoming_training',
    'view_apparatus', 'view_all_ppe', 'submit_vehicle_checks', 'submit_maintenance',
    'manage_assets', 'manage_locations', 'manage_vehicle_check_templates', 'manage_quiz_banks',
    'resolve_maintenance', 'manage_users', 'manage_incidents', 'view_fleet',
    'approval_tracker', 'access_professional_services', 'access_reports'
  ]::text[]) as cap
  on conflict (permission_level_id, capability) do nothing;

  insert into public.capability_display_order (client_id, capability, sort_order, group_name, label)
  select new.client_id, item.capability, item.sort_order, item.group_name, item.label
  from (values
    ('access_shift_exchange', 1, 'Modules', 'Shift Exchange'),
    ('access_shift_plan', 2, 'Modules', 'Shift Plan'),
    ('access_professional_services', 3, 'Modules', 'Professional Services'),
    ('access_programs', 4, 'Modules', 'Programs'),
    ('access_assets', 5, 'Modules', 'Assets'),
    ('access_personnel', 6, 'Modules', 'Personnel'),
    ('access_reports', 7, 'Modules', 'Reports'),
    ('browse_program_catalog', 8, 'Training', 'Browse program catalog'),
    ('self_enroll', 9, 'Training', 'Self-enroll in training'),
    ('author_training', 10, 'Training', 'Author training'),
    ('ems_qi', 11, 'Training', 'EMS QI'),
    ('document_training', 12, 'Training', 'Document training'),
    ('delete_training_reports', 13, 'Training', 'Delete training reports'),
    ('manage_upcoming_training', 14, 'Training', 'Manage upcoming training'),
    ('approval_tracker', 15, 'Training', 'Policy Tracker'),
    ('view_apparatus', 16, 'Assets & operations', 'View apparatus inventory'),
    ('view_fleet', 17, 'Assets & operations', 'View fleet shop'),
    ('view_all_ppe', 18, 'Assets & operations', 'View all equipment'),
    ('submit_vehicle_checks', 19, 'Assets & operations', 'Submit vehicle checks'),
    ('submit_maintenance', 20, 'Assets & operations', 'Submit maintenance requests'),
    ('manage_incidents', 21, 'Assets & operations', 'Manage incidents'),
    ('manage_assets', 22, 'Administration', 'Manage assets'),
    ('manage_locations', 23, 'Administration', 'Manage locations'),
    ('manage_vehicle_check_templates', 24, 'Administration', 'Manage check templates'),
    ('manage_quiz_banks', 25, 'Administration', 'Manage quiz banks'),
    ('resolve_maintenance', 26, 'Administration', 'Resolve maintenance'),
    ('manage_users', 27, 'Administration', 'Manage users')
  ) as item(capability, sort_order, group_name, label)
  on conflict (client_id, capability) do nothing;

  return new;
end;
$$;
