-- Swap checklists: optional destination apparatus (same type chosen in app)

alter table public.vehicle_checks
  add column if not exists swap_destination_asset_id uuid null
    references public.assets (id) on delete set null;

create index if not exists vehicle_checks_swap_destination_asset_id_idx
  on public.vehicle_checks (swap_destination_asset_id)
  where swap_destination_asset_id is not null;

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

  if new.swap_destination_asset_id = new.asset_id then
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

drop trigger if exists vehicle_checks_swap_destination_same_type on public.vehicle_checks;
create trigger vehicle_checks_swap_destination_same_type
  before insert or update of asset_id, swap_destination_asset_id on public.vehicle_checks
  for each row execute function public.vehicle_checks_swap_destination_same_type();
