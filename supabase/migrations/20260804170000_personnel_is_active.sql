-- Soft-deactivate personnel accounts (prefer over hard delete when history exists).

alter table public.profiles
  add column if not exists is_active boolean not null default true;

comment on column public.profiles.is_active is
  'When false, the member is deactivated and should not sign in or appear in active pickers.';

-- Prevent non-admins from changing account active status (or reactivating themselves).
create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     or new.is_admin is distinct from old.is_admin
     or new.is_active is distinct from old.is_active then
    if not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
    ) then
      raise exception 'Only system admins can change permission level, admin flag, or active status';
    end if;
  end if;
  return new;
end;
$$;
