-- Unit-based org leaders and incident command

alter table public.incidents
  add column if not exists ic_unit_id uuid references public.incident_units (id) on delete set null;

create index if not exists incidents_ic_unit_id_idx on public.incidents (ic_unit_id);

alter table public.incident_org_nodes
  add column if not exists leader_unit_id uuid references public.incident_units (id) on delete set null;

create index if not exists incident_org_nodes_leader_unit_id_idx
  on public.incident_org_nodes (leader_unit_id);
