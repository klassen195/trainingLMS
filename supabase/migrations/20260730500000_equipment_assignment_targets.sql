-- Equipment can be assigned to a person, station, or apparatus

do $$
begin
  if not exists (select 1 from pg_type where typname = 'equipment_assignment_type') then
    create type public.equipment_assignment_type as enum ('person', 'station', 'apparatus');
  end if;
end $$;

alter table public.assets
  add column if not exists assignment_type public.equipment_assignment_type null,
  add column if not exists assigned_station text null,
  add column if not exists assigned_apparatus_id uuid null
    references public.assets (id) on delete set null;

create index if not exists assets_assignment_type_idx on public.assets (assignment_type);
create index if not exists assets_assigned_station_idx on public.assets (assigned_station);
create index if not exists assets_assigned_apparatus_id_idx on public.assets (assigned_apparatus_id);

-- Existing person assignments
update public.assets
set assignment_type = 'person'
where kind = 'ppe'
  and assigned_to is not null
  and assignment_type is null;

alter table public.assets drop constraint if exists assets_equipment_assignment_check;

alter table public.assets
  add constraint assets_equipment_assignment_check check (
    (
      kind = 'apparatus'
      and assignment_type is null
      and assigned_station is null
      and assigned_apparatus_id is null
    )
    or (
      kind = 'ppe'
      and (
        (
          assignment_type is null
          and assigned_to is null
          and assigned_station is null
          and assigned_apparatus_id is null
        )
        or (
          assignment_type = 'person'
          and assigned_to is not null
          and assigned_station is null
          and assigned_apparatus_id is null
        )
        or (
          assignment_type = 'station'
          and assigned_station is not null
          and length(trim(assigned_station)) > 0
          and assigned_to is null
          and assigned_apparatus_id is null
        )
        or (
          assignment_type = 'apparatus'
          and assigned_apparatus_id is not null
          and assigned_to is null
          and assigned_station is null
        )
      )
    )
  );

create or replace function public.enforce_assigned_apparatus_kind()
returns trigger
language plpgsql
as $$
declare
  target_kind public.asset_kind;
begin
  if new.assigned_apparatus_id is null then
    return new;
  end if;
  if new.assigned_apparatus_id = new.id then
    raise exception 'Equipment cannot be assigned to itself';
  end if;
  select kind into target_kind from public.assets where id = new.assigned_apparatus_id;
  if target_kind is distinct from 'apparatus' then
    raise exception 'assigned_apparatus_id must reference an apparatus asset';
  end if;
  return new;
end;
$$;

drop trigger if exists assets_enforce_assigned_apparatus_kind on public.assets;
create trigger assets_enforce_assigned_apparatus_kind
  before insert or update of assigned_apparatus_id on public.assets
  for each row execute function public.enforce_assigned_apparatus_kind();
