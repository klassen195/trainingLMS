-- Swap return tracking: moved back / not moved back + optional return destination unit

do $$
begin
  if not exists (select 1 from pg_type where typname = 'vehicle_check_return_status') then
    create type public.vehicle_check_return_status as enum ('moved_back', 'not_moved_back');
  end if;
end $$;

alter table public.vehicle_check_responses
  add column if not exists return_status public.vehicle_check_return_status null;

alter table public.vehicle_check_responses
  add column if not exists return_destination_asset_id uuid null
    references public.assets (id) on delete set null;

create index if not exists vehicle_check_responses_return_destination_idx
  on public.vehicle_check_responses (return_destination_asset_id)
  where return_destination_asset_id is not null;

create or replace function public.vehicle_check_responses_return_destination_ok()
returns trigger
language plpgsql
as $$
declare
  dest_kind text;
begin
  if new.return_status is distinct from 'moved_back' then
    new.return_destination_asset_id := null;
    return new;
  end if;

  if new.return_destination_asset_id is null then
    raise exception 'Return destination is required when marking moved back';
  end if;

  select a.kind::text into dest_kind
  from public.assets a
  where a.id = new.return_destination_asset_id;

  if dest_kind is distinct from 'apparatus' then
    raise exception 'Return destination must be an apparatus unit';
  end if;

  return new;
end;
$$;

drop trigger if exists vehicle_check_responses_return_destination_ok on public.vehicle_check_responses;
create trigger vehicle_check_responses_return_destination_ok
  before insert or update of return_status, return_destination_asset_id on public.vehicle_check_responses
  for each row execute function public.vehicle_check_responses_return_destination_ok();
