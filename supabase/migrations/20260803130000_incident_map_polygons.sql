-- Polygon drawing layer for incident tactical maps (below unit markers)

create table if not exists public.incident_map_polygons (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  label text,
  -- Closed ring of [lng, lat] pairs (GeoJSON Polygon exterior ring; first == last preferred)
  coordinates jsonb not null,
  fill_color text not null default '#dc2626',
  fill_opacity double precision not null default 0.25,
  stroke_color text not null default '#991b1b',
  stroke_width double precision not null default 2,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint incident_map_polygons_coords_array check (jsonb_typeof(coordinates) = 'array'),
  constraint incident_map_polygons_fill_opacity_range check (fill_opacity >= 0 and fill_opacity <= 1),
  constraint incident_map_polygons_stroke_width_positive check (stroke_width > 0)
);

create index if not exists incident_map_polygons_incident_id_idx
  on public.incident_map_polygons (incident_id);

create or replace function public.set_incident_map_polygons_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists incident_map_polygons_updated_at on public.incident_map_polygons;
create trigger incident_map_polygons_updated_at
  before update on public.incident_map_polygons
  for each row
  execute function public.set_incident_map_polygons_updated_at();

alter table public.incident_map_polygons enable row level security;

drop policy if exists "incident_map_polygons_select" on public.incident_map_polygons;
create policy "incident_map_polygons_select"
  on public.incident_map_polygons for select
  to authenticated
  using (public.has_capability('manage_incidents'));

drop policy if exists "incident_map_polygons_insert" on public.incident_map_polygons;
create policy "incident_map_polygons_insert"
  on public.incident_map_polygons for insert
  to authenticated
  with check (public.has_capability('manage_incidents'));

drop policy if exists "incident_map_polygons_update" on public.incident_map_polygons;
create policy "incident_map_polygons_update"
  on public.incident_map_polygons for update
  to authenticated
  using (public.has_capability('manage_incidents'))
  with check (public.has_capability('manage_incidents'));

drop policy if exists "incident_map_polygons_delete" on public.incident_map_polygons;
create policy "incident_map_polygons_delete"
  on public.incident_map_polygons for delete
  to authenticated
  using (public.has_capability('manage_incidents'));

alter table public.incident_map_polygons replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'incident_map_polygons'
  ) then
    alter publication supabase_realtime add table public.incident_map_polygons;
  end if;
end $$;
