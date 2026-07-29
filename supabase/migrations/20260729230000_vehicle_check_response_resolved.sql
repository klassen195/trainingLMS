-- Track resolution of failed / low-level vehicle check responses

alter table public.vehicle_check_responses
  add column if not exists resolved_at timestamptz null;

alter table public.vehicle_check_responses
  add column if not exists resolved_by uuid null references public.profiles (id) on delete set null;

create index if not exists vehicle_check_responses_unresolved_idx
  on public.vehicle_check_responses (vehicle_check_id)
  where resolved_at is null;

drop policy if exists "vehicle_check_responses_update" on public.vehicle_check_responses;

create policy "vehicle_check_responses_update"
  on public.vehicle_check_responses for update
  to authenticated
  using (
    exists (
      select 1
      from public.vehicle_checks vc
      join public.assets a on a.id = vc.asset_id
      where vc.id = vehicle_check_id
        and (public.is_admin() or a.kind = 'apparatus')
    )
  )
  with check (
    exists (
      select 1
      from public.vehicle_checks vc
      join public.assets a on a.id = vc.asset_id
      where vc.id = vehicle_check_id
        and (public.is_admin() or a.kind = 'apparatus')
    )
  );
