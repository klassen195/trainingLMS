-- Move sensitive personnel demographics off profiles so directory SELECT can stay
-- open for roster fields without exposing home address / emergency / HR / family PII.
-- Also harden own-row profile UPDATEs for admin-only org columns.

create table if not exists public.personnel_private (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  home_address text,
  emergency_contacts text,
  hr_info text,
  anniversary date,
  spouse_name text,
  spouse_birthday date,
  kids_birthdays text,
  updated_at timestamptz not null default now()
);

comment on table public.personnel_private is
  'Sensitive personnel demographics; readable by self, admins, and supervisors only';

insert into public.personnel_private (
  profile_id,
  client_id,
  home_address,
  emergency_contacts,
  hr_info,
  anniversary,
  spouse_name,
  spouse_birthday,
  kids_birthdays
)
select
  p.id,
  p.client_id,
  p.home_address,
  p.emergency_contacts,
  p.hr_info,
  p.anniversary,
  p.spouse_name,
  p.spouse_birthday,
  p.kids_birthdays
from public.profiles p
where p.client_id is not null
on conflict (profile_id) do nothing;

alter table public.profiles
  drop column if exists home_address,
  drop column if exists emergency_contacts,
  drop column if exists hr_info,
  drop column if exists anniversary,
  drop column if exists spouse_name,
  drop column if exists spouse_birthday,
  drop column if exists kids_birthdays;

create or replace function public.personnel_private_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists personnel_private_touch_updated_at on public.personnel_private;
create trigger personnel_private_touch_updated_at
  before update on public.personnel_private
  for each row
  execute function public.personnel_private_touch_updated_at();

create or replace function public.personnel_private_ensure_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.client_id is null then
    return new;
  end if;
  insert into public.personnel_private (profile_id, client_id)
  values (new.id, new.client_id)
  on conflict (profile_id) do update
    set client_id = excluded.client_id;
  return new;
end;
$$;

drop trigger if exists personnel_private_ensure_for_profile on public.profiles;
create trigger personnel_private_ensure_for_profile
  after insert or update of client_id on public.profiles
  for each row
  execute function public.personnel_private_ensure_for_profile();

create or replace function public.personnel_private_guard_hr_info()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.hr_info is distinct from old.hr_info and not public.is_admin() then
    raise exception 'Only an administrator can change HR info.';
  end if;
  return new;
end;
$$;

drop trigger if exists personnel_private_guard_hr_info on public.personnel_private;
create trigger personnel_private_guard_hr_info
  before update on public.personnel_private
  for each row
  execute function public.personnel_private_guard_hr_info();

alter table public.personnel_private enable row level security;

drop policy if exists tenant_isolation on public.personnel_private;
create policy tenant_isolation on public.personnel_private
  as restrictive for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

drop policy if exists "personnel_private_select" on public.personnel_private;
create policy "personnel_private_select"
  on public.personnel_private for select
  to authenticated
  using (
    profile_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.profiles p
      where p.id = personnel_private.profile_id
        and p.supervisor_id = auth.uid()
    )
    or public.is_battalion_chief_of(personnel_private.profile_id)
  );

drop policy if exists "personnel_private_insert" on public.personnel_private;
create policy "personnel_private_insert"
  on public.personnel_private for insert
  to authenticated
  with check (
    profile_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "personnel_private_update" on public.personnel_private;
create policy "personnel_private_update"
  on public.personnel_private for update
  to authenticated
  using (
    profile_id = auth.uid()
    or public.is_admin()
  )
  with check (
    profile_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "personnel_private_delete" on public.personnel_private;
create policy "personnel_private_delete"
  on public.personnel_private for delete
  to authenticated
  using (public.is_admin());

-- Own-row UPDATE may not change admin-managed org columns (align with edit_own_personnel).
create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.is_platform_operator is distinct from old.is_platform_operator
     or new.platform_operator_eligible is distinct from old.platform_operator_eligible then
    if not public.is_platform_admin() then
      raise exception 'Only a platform operator can change platform operator access.';
    end if;
  end if;

  if new.is_admin is distinct from old.is_admin
     or new.is_active is distinct from old.is_active then
    if not public.is_admin() then
      raise exception 'Only an administrator can change admin or active status.';
    end if;
  end if;

  if not public.is_admin() then
    if new.rank is distinct from old.rank
       or new.job_title is distinct from old.job_title
       or new.swing_up is distinct from old.swing_up
       or new.rank_promoted_on is distinct from old.rank_promoted_on
       or new.employee_number is distinct from old.employee_number
       or new.department is distinct from old.department
       or new.hire_date is distinct from old.hire_date
       or new.shift is distinct from old.shift
       or new.primary_location_id is distinct from old.primary_location_id
       or new.supervisor_id is distinct from old.supervisor_id
       or new.ems_cleared_level_id is distinct from old.ems_cleared_level_id
       or new.email is distinct from old.email
       or new.client_id is distinct from old.client_id then
      raise exception 'Only an administrator can change organization profile fields.';
    end if;
  end if;

  return new;
end;
$$;
