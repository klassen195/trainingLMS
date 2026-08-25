-- Allow maintenance requests for equipment as well as apparatus.

drop trigger if exists maintenance_requests_require_apparatus on public.maintenance_requests;
drop function if exists public.maintenance_requests_require_apparatus();

create or replace function public.maintenance_request_apply_out_of_service(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req record;
begin
  select id, asset_id, service_status, requested_by, status
  into req
  from public.maintenance_requests
  where id = p_request_id;

  if not found then
    raise exception 'Maintenance request not found.';
  end if;

  if req.status is distinct from 'open' then
    raise exception 'Maintenance request is not open.';
  end if;

  if req.requested_by is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Not allowed to update asset status for this request.';
  end if;

  if req.service_status = 'out_of_service' then
    update public.assets
    set status = 'out_of_service'
    where id = req.asset_id
      and status is distinct from 'out_of_service';
  end if;
end;
$$;
