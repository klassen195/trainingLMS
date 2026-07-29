-- Link swap-return history rows to the original swap check

alter table public.vehicle_checks
  add column if not exists parent_vehicle_check_id uuid null
    references public.vehicle_checks (id) on delete cascade;

create index if not exists vehicle_checks_parent_id_idx
  on public.vehicle_checks (parent_vehicle_check_id)
  where parent_vehicle_check_id is not null;

alter table public.vehicle_check_responses
  add column if not exists source_response_id uuid null
    references public.vehicle_check_responses (id) on delete set null;

create index if not exists vehicle_check_responses_source_response_id_idx
  on public.vehicle_check_responses (source_response_id)
  where source_response_id is not null;

-- Return events may log "moved back to" the same unit as the acting asset.
create or replace function public.vehicle_checks_swap_destination_same_type()
returns trigger
language plpgsql
as $$
declare
  source_type text;
  dest_kind text;
  dest_type text;
begin
  if new.swap_destination_asset_id is null then
    return new;
  end if;

  if new.parent_vehicle_check_id is null
     and new.swap_destination_asset_id = new.asset_id then
    raise exception 'Swap destination must be a different unit';
  end if;

  select a.apparatus_type::text into source_type
  from public.assets a
  where a.id = new.asset_id;

  select a.kind::text, a.apparatus_type::text into dest_kind, dest_type
  from public.assets a
  where a.id = new.swap_destination_asset_id;

  if dest_kind is distinct from 'apparatus' then
    raise exception 'Swap destination must be an apparatus unit';
  end if;

  if source_type is not null and dest_type is distinct from source_type then
    raise exception 'Swap destination must be the same apparatus type';
  end if;

  return new;
end;
$$;
