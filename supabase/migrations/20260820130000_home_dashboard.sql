-- Home operations dashboard: per-user widget layout and department flag/weather settings

create table if not exists public.home_dashboard_layouts (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  client_id uuid not null references public.clients (id),
  widget_types text[] not null default '{}',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists home_dashboard_layouts_client_id_idx
  on public.home_dashboard_layouts (client_id);

create table if not exists public.client_ops_settings (
  client_id uuid primary key references public.clients (id) on delete cascade,
  weather_latitude double precision not null default 47.677683,
  weather_longitude double precision not null default -116.780466,
  weather_label text not null default 'Coeur d''Alene',
  flag_level text not null default 'unset',
  flag_note text,
  flag_updated_at timestamptz,
  flag_updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_ops_settings_flag_level_check check (
    flag_level in ('unset', 'low', 'moderate', 'high', 'very_high', 'extreme')
  ),
  constraint client_ops_settings_weather_label_nonempty check (length(trim(weather_label)) > 0)
);

create or replace function public.set_home_dashboard_layouts_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists home_dashboard_layouts_updated_at on public.home_dashboard_layouts;
create trigger home_dashboard_layouts_updated_at
  before update on public.home_dashboard_layouts
  for each row execute function public.set_home_dashboard_layouts_updated_at();

create or replace function public.set_client_ops_settings_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists client_ops_settings_updated_at on public.client_ops_settings;
create trigger client_ops_settings_updated_at
  before update on public.client_ops_settings
  for each row execute function public.set_client_ops_settings_updated_at();

drop trigger if exists set_client_id_default on public.home_dashboard_layouts;
create trigger set_client_id_default
  before insert on public.home_dashboard_layouts
  for each row execute function public.set_row_client_id();

drop trigger if exists set_client_id_default on public.client_ops_settings;
create trigger set_client_id_default
  before insert on public.client_ops_settings
  for each row execute function public.set_row_client_id();

alter table public.home_dashboard_layouts enable row level security;
alter table public.client_ops_settings enable row level security;

drop policy if exists tenant_isolation on public.home_dashboard_layouts;
create policy tenant_isolation on public.home_dashboard_layouts
  as restrictive for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

drop policy if exists tenant_isolation on public.client_ops_settings;
create policy tenant_isolation on public.client_ops_settings
  as restrictive for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

drop policy if exists home_dashboard_layouts_select_own on public.home_dashboard_layouts;
create policy home_dashboard_layouts_select_own
  on public.home_dashboard_layouts for select
  to authenticated
  using (profile_id = auth.uid());

drop policy if exists home_dashboard_layouts_insert_own on public.home_dashboard_layouts;
create policy home_dashboard_layouts_insert_own
  on public.home_dashboard_layouts for insert
  to authenticated
  with check (profile_id = auth.uid());

drop policy if exists home_dashboard_layouts_update_own on public.home_dashboard_layouts;
create policy home_dashboard_layouts_update_own
  on public.home_dashboard_layouts for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists home_dashboard_layouts_delete_own on public.home_dashboard_layouts;
create policy home_dashboard_layouts_delete_own
  on public.home_dashboard_layouts for delete
  to authenticated
  using (profile_id = auth.uid());

drop policy if exists client_ops_settings_select on public.client_ops_settings;
create policy client_ops_settings_select
  on public.client_ops_settings for select
  to authenticated
  using (true);

drop policy if exists client_ops_settings_insert_admin on public.client_ops_settings;
create policy client_ops_settings_insert_admin
  on public.client_ops_settings for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists client_ops_settings_update_admin on public.client_ops_settings;
create policy client_ops_settings_update_admin
  on public.client_ops_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
