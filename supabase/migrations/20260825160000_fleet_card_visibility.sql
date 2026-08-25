-- Per-apparatus flag: include on the Fleet card board (table view still shows all).

alter table public.assets
  add column if not exists show_on_fleet_cards boolean not null default true;

create or replace function public.set_asset_show_on_fleet_cards(
  p_asset_id uuid,
  p_visible boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  asset_kind public.asset_kind;
begin
  if not (
    public.is_admin()
    or public.has_capability('view_fleet')
    or public.has_capability('manage_assets')
  ) then
    raise exception 'Not allowed to change fleet card visibility.';
  end if;

  select kind into asset_kind
  from public.assets
  where id = p_asset_id;

  if not found then
    raise exception 'Apparatus not found.';
  end if;
  if asset_kind is distinct from 'apparatus' then
    raise exception 'Fleet card visibility is limited to apparatus.';
  end if;

  update public.assets
  set show_on_fleet_cards = p_visible
  where id = p_asset_id;
end;
$$;

revoke all on function public.set_asset_show_on_fleet_cards(uuid, boolean) from public;
revoke all on function public.set_asset_show_on_fleet_cards(uuid, boolean) from anon;
grant execute on function public.set_asset_show_on_fleet_cards(uuid, boolean) to authenticated;
