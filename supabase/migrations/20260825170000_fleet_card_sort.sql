-- Custom order for Fleet card board units within a type group.

alter table public.assets
  add column if not exists fleet_card_sort integer not null default 0;

create or replace function public.reorder_fleet_cards(p_asset_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  updated integer;
begin
  if not (
    public.is_admin()
    or public.has_capability('view_fleet')
    or public.has_capability('manage_assets')
  ) then
    raise exception 'Not allowed to reorder fleet cards.';
  end if;

  if p_asset_ids is null or coalesce(array_length(p_asset_ids, 1), 0) = 0 then
    return;
  end if;

  update public.assets a
  set fleet_card_sort = s.sort_order
  from unnest(p_asset_ids) with ordinality as s(id, sort_order)
  where a.id = s.id
    and a.kind = 'apparatus';

  get diagnostics updated = row_count;
  if updated is distinct from array_length(p_asset_ids, 1) then
    raise exception 'Could not reorder those units.';
  end if;
end;
$$;

revoke all on function public.reorder_fleet_cards(uuid[]) from public;
revoke all on function public.reorder_fleet_cards(uuid[]) from anon;
grant execute on function public.reorder_fleet_cards(uuid[]) to authenticated;
