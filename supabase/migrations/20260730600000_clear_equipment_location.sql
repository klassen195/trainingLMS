-- Equipment uses Assigned to (including station) instead of Location.
-- Preserve former locations as station assignments when unassigned, then clear station on PPE.

update public.assets
set
  assignment_type = 'station',
  assigned_station = trim(station)
where kind = 'ppe'
  and assignment_type is null
  and station is not null
  and length(trim(station)) > 0;

update public.assets
set station = null
where kind = 'ppe'
  and station is not null;

alter table public.assets drop constraint if exists assets_station_by_kind_check;

alter table public.assets
  add constraint assets_station_by_kind_check check (
    (kind = 'ppe' and station is null)
    or (kind = 'apparatus')
  );
