-- Split platform operator eligibility from active elevated mode.
-- Eligible users can enter/exit platform mode; only elevated users are hidden from rosters.

alter table public.profiles
  add column if not exists platform_operator_eligible boolean not null default false;

-- Existing elevated operators are eligible.
update public.profiles p
set platform_operator_eligible = true
where coalesce(p.is_platform_operator, false) = true
   or exists (
     select 1
     from auth.users u
     where u.id = p.id
       and coalesce((u.raw_app_meta_data ->> 'is_platform_admin')::boolean, false)
   );

-- Mirror eligibility into JWT app_metadata for clients that check claims.
update auth.users u
set raw_app_meta_data =
  coalesce(u.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('platform_operator_eligible', true)
where coalesce((u.raw_app_meta_data ->> 'is_platform_admin')::boolean, false)
   or exists (
     select 1
     from public.profiles p
     where p.id = u.id
       and coalesce(p.platform_operator_eligible, false) = true
   );

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
  return new;
end;
$$;
