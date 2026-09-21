-- Admin-editable taskbook catalog (types + prerequisites).
-- Drops hardcoded rank CHECKs so new taskbooks no longer need migrations.

-- ---------------------------------------------------------------------------
-- Catalog tables
-- ---------------------------------------------------------------------------

create table if not exists public.taskbook_types (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  group_key text not null default 'other',
  group_label text not null default 'Other',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  auto_issued boolean not null default false,
  requestable boolean not null default true,
  notes text not null default '',
  constraint taskbook_types_name_unique unique (name),
  constraint taskbook_types_name_not_blank check (length(trim(name)) > 0),
  constraint taskbook_types_group_key_not_blank check (length(trim(group_key)) > 0),
  constraint taskbook_types_group_label_not_blank check (length(trim(group_label)) > 0)
);

create index if not exists taskbook_types_sort_order_idx
  on public.taskbook_types (sort_order, name);
create index if not exists taskbook_types_is_active_idx
  on public.taskbook_types (is_active);
create index if not exists taskbook_types_group_key_idx
  on public.taskbook_types (group_key, sort_order);

create or replace function public.set_taskbook_types_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists taskbook_types_updated_at on public.taskbook_types;
create trigger taskbook_types_updated_at
  before update on public.taskbook_types
  for each row
  execute function public.set_taskbook_types_updated_at();

alter table public.taskbook_types enable row level security;

drop policy if exists "taskbook_types_select_authenticated" on public.taskbook_types;
create policy "taskbook_types_select_authenticated"
  on public.taskbook_types for select
  to authenticated
  using (true);

drop policy if exists "taskbook_types_insert_admin" on public.taskbook_types;
create policy "taskbook_types_insert_admin"
  on public.taskbook_types for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "taskbook_types_update_admin" on public.taskbook_types;
create policy "taskbook_types_update_admin"
  on public.taskbook_types for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "taskbook_types_delete_admin" on public.taskbook_types;
create policy "taskbook_types_delete_admin"
  on public.taskbook_types for delete
  to authenticated
  using (public.is_admin());

create table if not exists public.taskbook_prerequisites (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  taskbook_type_id uuid not null references public.taskbook_types (id) on delete cascade,
  code text not null,
  label text not null,
  sort_order integer not null default 0,
  constraint taskbook_prerequisites_code_not_blank check (length(trim(code)) > 0),
  constraint taskbook_prerequisites_label_not_blank check (length(trim(label)) > 0),
  constraint taskbook_prerequisites_type_code_unique unique (taskbook_type_id, code)
);

create index if not exists taskbook_prerequisites_type_id_idx
  on public.taskbook_prerequisites (taskbook_type_id, sort_order);

alter table public.taskbook_prerequisites enable row level security;

drop policy if exists "taskbook_prerequisites_select_authenticated" on public.taskbook_prerequisites;
create policy "taskbook_prerequisites_select_authenticated"
  on public.taskbook_prerequisites for select
  to authenticated
  using (true);

drop policy if exists "taskbook_prerequisites_insert_admin" on public.taskbook_prerequisites;
create policy "taskbook_prerequisites_insert_admin"
  on public.taskbook_prerequisites for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "taskbook_prerequisites_update_admin" on public.taskbook_prerequisites;
create policy "taskbook_prerequisites_update_admin"
  on public.taskbook_prerequisites for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "taskbook_prerequisites_delete_admin" on public.taskbook_prerequisites;
create policy "taskbook_prerequisites_delete_admin"
  on public.taskbook_prerequisites for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Free the instance tables from hardcoded rank allow-lists
-- ---------------------------------------------------------------------------

alter table public.personnel_taskbooks
  drop constraint if exists personnel_taskbooks_rank_valid;

alter table public.personnel_taskbook_prerequisite_checks
  drop constraint if exists personnel_taskbook_prereq_rank_valid;

-- ---------------------------------------------------------------------------
-- Seed current catalog (idempotent by name)
-- ---------------------------------------------------------------------------

insert into public.taskbook_types (name, group_key, group_label, sort_order, auto_issued, requestable)
values
  ('Firefighter', 'rank', 'Rank', 1, true, false),
  ('Engineer', 'rank', 'Rank', 2, false, true),
  ('Captain', 'rank', 'Rank', 3, false, true),
  ('MSO', 'rank', 'Rank', 4, false, true),
  ('Battalion Chief', 'rank', 'Rank', 5, false, true),
  ('Deputy Fire Marshal', 'rank', 'Rank', 6, false, true),
  ('Fire Boat Operator', 'specialty', 'Specialty', 7, false, true),
  ('Rescue Boat Operator', 'specialty', 'Specialty', 8, false, true),
  ('Drone Operator', 'specialty', 'Specialty', 9, false, true),
  ('EMT', 'ems', 'EMS', 10, false, true),
  ('AEMT', 'ems', 'EMS', 11, false, true),
  ('Paramedic', 'ems', 'EMS', 12, false, true),
  ('Critical Care Transport', 'ems', 'EMS', 13, false, true),
  ('REMS', 'wildland', 'Wildland', 14, false, true),
  ('FFT1 (Squad Boss)', 'wildland', 'Wildland', 15, false, true),
  ('Single Resource Boss', 'wildland', 'Wildland', 16, false, true)
on conflict (name) do nothing;

insert into public.taskbook_prerequisites (taskbook_type_id, code, label, sort_order)
select t.id, p.code, p.label, p.sort_order
from public.taskbook_types t
join (
  values
    ('Engineer', 'eng-driver-operator', 'Driver Operator Certification or Equivalent', 1),
    ('Engineer', 'eng-iso', 'Incident Safety Officer Certification', 2),
    ('Engineer', 'eng-ff-probation', 'Successfully Passed Firefighter Probation', 3),
    ('Captain', 'cap-eng-taskbook', 'Completed Engineer Task Book', 1),
    ('Captain', 'cap-fo1', 'Fire Officer 1 or meets NFPA 1021 Standards', 2),
    ('Captain', 'cap-ic300', 'Incident Command (IC) 300', 3),
    ('Captain', 'cap-blue-card', 'Blue Card / Calming the Chaos or an equivalent approved course', 4),
    ('Captain', 'cap-s131', 'S-131/G-131 (preferred)', 5),
    ('Captain', 'cap-cfi-first-responders', 'CFI Trainer - First Responders Impact Fire Investigations', 6),
    ('Captain', 'cap-cfi-fire-flow', 'CFI Trainer - Fire Flow Analysis', 7),
    ('Captain', 'cap-cfi-wildland', 'CFI Trainer - Wildland Investigations', 8),
    ('Captain', 'cap-cfi-vehicle', 'CFI Trainer - Investigating Vehicle Fires', 9),
    ('Captain', 'cap-cfi-youth', 'CFI Trainer - Youth Set Fires', 10),
    ('Captain', 'cap-building-construction', 'Building Construction Course', 11),
    ('Captain', 'cap-leadership', 'Leadership Training (32 Hours)', 12),
    ('Captain', 'cap-strategy-tactics', 'Strategy & Tactics (32 Hours)', 13),
    ('Captain', 'cap-progressive-discipline', 'Progressive Discipline Course (preferred)', 14),
    ('Battalion Chief', 'bc-12mo-captain', 'Completion of twelve (12) months as a promoted Captain', 1),
    ('Battalion Chief', 'bc-fo2', 'Meet NFPA 1021 knowledge and skill standards for Fire Officer II', 2),
    ('Battalion Chief', 'bc-media', 'Working with the Media Course (AWR 209 – preferred)', 3),
    ('Battalion Chief', 'bc-ic300', 'Incident Command (IC) FEMA Level 300', 4),
    ('Battalion Chief', 'bc-ic400', 'Incident Command (IC) FEMA Level 400', 5),
    ('Battalion Chief', 'bc-blue-card', 'Blue Card/Calming the Chaos or an equivalent approved course', 6),
    ('MSO', 'mso-ccp-fpc', 'Completion of the CCP or FPC Certification', 1),
    ('MSO', 'mso-captain-qualified', 'Captain Qualified', 2),
    ('Critical Care Transport', 'cct-ccp-fpc', 'Completion of their CCP or FPC certification', 1),
    ('EMT', 'emt-idaho-card', 'Current Idaho EMT Card', 1),
    ('AEMT', 'aemt-idaho-card', 'Current Idaho AEMT Card', 1),
    ('Paramedic', 'paramedic-idaho-card', 'Current Idaho Paramedic Card', 1),
    ('Fire Boat Operator', 'boat-idaho-safety', 'Completed Idaho Boater Safety Course', 1),
    ('Fire Boat Operator', 'boat-kcfr-crewmember', 'Completed KCFR Crewmember Training', 2),
    ('Rescue Boat Operator', 'rescue-boat-idaho-safety', 'Completed Idaho Boater Safety Course', 1),
    ('Rescue Boat Operator', 'rescue-boat-swim-test', 'Passed KCFR Swim Test', 2),
    ('Rescue Boat Operator', 'rescue-boat-class', 'Rescue Boat Class', 3),
    ('Rescue Boat Operator', 'rescue-boat-swift-water', 'Swift Water Class', 4),
    ('Drone Operator', 'drone-formal-training', 'Completion of Formal Training Class (Online or Classroom)', 1),
    ('REMS', 'rems-s130', 'NWCG S-130 Wildland Firefighter Training', 1),
    ('REMS', 'rems-s131', 'NWCG S-131 Firefighter Type I (preferred)', 2),
    ('REMS', 'rems-s190', 'NWCG S-190 Introduction to Wildland Fire Behavior', 3),
    ('REMS', 'rems-l180', 'NWCG L-180 Human Factors in the Wildland Fire Service', 4),
    ('FFT1 (Squad Boss)', 'fft1-s131', 'S-131', 1),
    ('Single Resource Boss', 'srb-s230', 'S-230', 1),
    ('Single Resource Boss', 'srb-s290', 'S-290', 2)
) as p(type_name, code, label, sort_order)
  on t.name = p.type_name
on conflict (taskbook_type_id, code) do nothing;
