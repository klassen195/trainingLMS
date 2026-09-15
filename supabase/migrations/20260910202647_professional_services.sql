-- Professional Services: provider directory with recommend / recommend-against reviews.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'professional_service_category') then
    create type public.professional_service_category as enum (
      'doctor',
      'dentist',
      'mechanic',
      'contractor',
      'veterinarian',
      'attorney',
      'financial_advisor',
      'home_services',
      'other'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'professional_service_verdict') then
    create type public.professional_service_verdict as enum (
      'recommend',
      'recommend_against'
    );
  end if;
end $$;

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
      'access_professional_services'
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
      'access_professional_services'
    )
  );

create table if not exists public.professional_service_providers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  category public.professional_service_category not null,
  specialty text not null default '',
  phone text not null default '',
  email text not null default '',
  website text not null default '',
  city text not null default '',
  address text not null default '',
  notes text not null default '',
  is_hidden boolean not null default false,
  constraint professional_service_providers_name_nonempty check (length(trim(name)) > 0)
);

create index if not exists professional_service_providers_client_category_idx
  on public.professional_service_providers (client_id, category, name);

create index if not exists professional_service_providers_client_name_idx
  on public.professional_service_providers (client_id, name);

create or replace function public.set_professional_service_providers_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists professional_service_providers_updated_at on public.professional_service_providers;
create trigger professional_service_providers_updated_at
  before update on public.professional_service_providers
  for each row
  execute function public.set_professional_service_providers_updated_at();

drop trigger if exists set_client_id_default on public.professional_service_providers;
create trigger set_client_id_default
  before insert on public.professional_service_providers
  for each row
  execute function public.set_row_client_id();

create table if not exists public.professional_service_reviews (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  provider_id uuid not null references public.professional_service_providers (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verdict public.professional_service_verdict not null,
  is_anonymous boolean not null default false,
  body text not null default '',
  used_for text not null default '',
  service_date date
);

create unique index if not exists professional_service_reviews_one_per_user_idx
  on public.professional_service_reviews (client_id, provider_id, created_by);

create index if not exists professional_service_reviews_provider_idx
  on public.professional_service_reviews (provider_id, created_at desc);

create or replace function public.set_professional_service_reviews_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists professional_service_reviews_updated_at on public.professional_service_reviews;
create trigger professional_service_reviews_updated_at
  before update on public.professional_service_reviews
  for each row
  execute function public.set_professional_service_reviews_updated_at();

drop trigger if exists set_client_id_default on public.professional_service_reviews;
create trigger set_client_id_default
  before insert on public.professional_service_reviews
  for each row
  execute function public.set_row_client_id();

alter table public.professional_service_providers enable row level security;
alter table public.professional_service_reviews enable row level security;

drop policy if exists tenant_isolation on public.professional_service_providers;
create policy tenant_isolation on public.professional_service_providers
  as restrictive for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

drop policy if exists professional_service_providers_select on public.professional_service_providers;
create policy professional_service_providers_select
  on public.professional_service_providers for select
  to authenticated
  using (
    public.has_capability('access_professional_services')
    and (not is_hidden or public.is_admin() or created_by = auth.uid())
  );

drop policy if exists professional_service_providers_insert on public.professional_service_providers;
create policy professional_service_providers_insert
  on public.professional_service_providers for insert
  to authenticated
  with check (public.has_capability('access_professional_services'));

drop policy if exists professional_service_providers_update on public.professional_service_providers;
create policy professional_service_providers_update
  on public.professional_service_providers for update
  to authenticated
  using (
    public.has_capability('access_professional_services')
    and (created_by = auth.uid() or public.is_admin())
  )
  with check (
    public.has_capability('access_professional_services')
    and (created_by = auth.uid() or public.is_admin())
  );

drop policy if exists professional_service_providers_delete on public.professional_service_providers;
create policy professional_service_providers_delete
  on public.professional_service_providers for delete
  to authenticated
  using (
    public.has_capability('access_professional_services')
    and (created_by = auth.uid() or public.is_admin())
  );

drop policy if exists tenant_isolation on public.professional_service_reviews;
create policy tenant_isolation on public.professional_service_reviews
  as restrictive for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

drop policy if exists professional_service_reviews_select on public.professional_service_reviews;
create policy professional_service_reviews_select
  on public.professional_service_reviews for select
  to authenticated
  using (
    public.has_capability('access_professional_services')
    and exists (
      select 1
      from public.professional_service_providers p
      where p.id = provider_id
        and (
          not p.is_hidden
          or public.is_admin()
          or p.created_by = auth.uid()
        )
    )
  );

drop policy if exists professional_service_reviews_insert on public.professional_service_reviews;
create policy professional_service_reviews_insert
  on public.professional_service_reviews for insert
  to authenticated
  with check (
    public.has_capability('access_professional_services')
    and created_by = auth.uid()
  );

drop policy if exists professional_service_reviews_update on public.professional_service_reviews;
create policy professional_service_reviews_update
  on public.professional_service_reviews for update
  to authenticated
  using (
    public.has_capability('access_professional_services')
    and created_by = auth.uid()
  )
  with check (
    public.has_capability('access_professional_services')
    and created_by = auth.uid()
  );

drop policy if exists professional_service_reviews_delete on public.professional_service_reviews;
create policy professional_service_reviews_delete
  on public.professional_service_reviews for delete
  to authenticated
  using (
    public.has_capability('access_professional_services')
    and (created_by = auth.uid() or public.is_admin())
  );

grant select, insert, update, delete on public.professional_service_providers to authenticated;
grant all on public.professional_service_providers to service_role;
grant select, insert, update, delete on public.professional_service_reviews to authenticated;
grant all on public.professional_service_reviews to service_role;

insert into public.permission_level_capabilities (client_id, permission_level_id, capability, enabled)
select pl.client_id, pl.id, 'access_professional_services', true
from public.permission_levels pl
on conflict (permission_level_id, capability) do nothing;

insert into public.capability_display_order (client_id, capability, sort_order, group_name, label)
select c.id, 'access_professional_services', 6, 'Modules', 'Professional Services'
from public.clients c
on conflict (client_id, capability) do update
set group_name = excluded.group_name,
    label = excluded.label;

with ranked as (
  select
    client_id,
    capability,
    row_number() over (
      partition by client_id
      order by
        case when group_name = 'Modules' then 0 else 1 end,
        case capability
          when 'access_shift_exchange' then 1
          when 'access_shift_plan' then 2
          when 'access_professional_services' then 3
          else 10
        end,
        sort_order,
        capability
    ) as next_order
  from public.capability_display_order
)
update public.capability_display_order d
set sort_order = ranked.next_order
from ranked
where d.client_id = ranked.client_id
  and d.capability = ranked.capability;

create or replace function public.permission_levels_seed_capabilities()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.permission_level_capabilities (client_id, permission_level_id, capability, enabled)
  select new.client_id, new.id, cap, cap in (
    'access_shift_exchange',
    'access_shift_plan',
    'access_professional_services',
    'access_programs',
    'access_assets',
    'access_personnel'
  )
  from unnest(array[
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
    'access_professional_services'
  ]::text[]) as cap
  on conflict (permission_level_id, capability) do nothing;

  insert into public.capability_display_order (client_id, capability, sort_order, group_name, label)
  select new.client_id, item.capability, item.sort_order, item.group_name, item.label
  from (
    values
      ('access_shift_exchange', 1, 'Modules', 'Shift Exchange'),
      ('access_shift_plan', 2, 'Modules', 'Shift Plan'),
      ('access_professional_services', 3, 'Modules', 'Professional Services'),
      ('access_programs', 4, 'Modules', 'Programs'),
      ('access_assets', 5, 'Modules', 'Assets'),
      ('access_personnel', 6, 'Modules', 'Personnel'),
      ('browse_program_catalog', 7, 'Training', 'Browse program catalog'),
      ('self_enroll', 8, 'Training', 'Self-enroll in training'),
      ('author_training', 9, 'Training', 'Author training'),
      ('ems_qi', 10, 'Training', 'EMS QI'),
      ('document_training', 11, 'Training', 'Document training'),
      ('delete_training_reports', 12, 'Training', 'Delete training reports'),
      ('approval_tracker', 13, 'Training', 'Policy Tracker'),
      ('view_apparatus', 14, 'Assets & operations', 'View apparatus inventory'),
      ('view_fleet', 15, 'Assets & operations', 'View fleet shop'),
      ('view_all_ppe', 16, 'Assets & operations', 'View all equipment'),
      ('submit_vehicle_checks', 17, 'Assets & operations', 'Submit vehicle checks'),
      ('submit_maintenance', 18, 'Assets & operations', 'Submit maintenance requests'),
      ('manage_incidents', 19, 'Assets & operations', 'Manage incidents'),
      ('manage_assets', 20, 'Administration', 'Manage assets'),
      ('manage_locations', 21, 'Administration', 'Manage locations'),
      ('manage_vehicle_check_templates', 22, 'Administration', 'Manage check templates'),
      ('manage_quiz_banks', 23, 'Administration', 'Manage quiz banks'),
      ('resolve_maintenance', 24, 'Administration', 'Resolve maintenance'),
      ('manage_users', 25, 'Administration', 'Manage users')
  ) as item(capability, sort_order, group_name, label)
  on conflict (client_id, capability) do nothing;

  return new;
end;
$$;
