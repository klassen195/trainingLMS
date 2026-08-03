-- Permission levels: recruit / firefighter / captain + is_admin flag

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

update public.profiles
set is_admin = true
where role::text = 'admin';

-- Switch helpers to the new model before remapping the enum
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
  );
$$;

-- Staff / training authors: captain permission level or system admin
create or replace function public.is_instructor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (p.is_admin = true or p.role::text in ('captain', 'instructor', 'admin'))
  );
$$;

create or replace function public.is_recruit()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role::text = 'recruit'
      and p.is_admin = false
  );
$$;

create or replace function public.is_enrolled_in_program(p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.program_modules pm
    join public.module_enrollments me on me.module_id = pm.module_id
    where pm.program_id = p_program_id
      and me.user_id = auth.uid()
  );
$$;

-- Remap role enum: admin/instructor -> captain, learner -> firefighter
create type public.user_role_new as enum ('recruit', 'firefighter', 'captain');

alter table public.profiles
  alter column role drop default;

alter table public.profiles
  add column role_new public.user_role_new;

update public.profiles
set role_new = case
  when role::text in ('admin', 'instructor') then 'captain'::public.user_role_new
  when role::text = 'learner' then 'firefighter'::public.user_role_new
  when role::text = 'recruit' then 'recruit'::public.user_role_new
  when role::text = 'firefighter' then 'firefighter'::public.user_role_new
  when role::text = 'captain' then 'captain'::public.user_role_new
  else 'firefighter'::public.user_role_new
end;

alter table public.profiles drop column role;
alter table public.profiles rename column role_new to role;

alter table public.profiles
  alter column role set not null;

alter table public.profiles
  alter column role set default 'firefighter'::public.user_role_new;

drop type public.user_role;
alter type public.user_role_new rename to user_role;

-- Finalize helpers against the new enum values only
create or replace function public.is_instructor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (p.is_admin = true or p.role = 'captain')
  );
$$;

create or replace function public.is_recruit()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'recruit'
      and p.is_admin = false
  );
$$;

-- Recruits only see enrolled published programs (plus owner/admin)
drop policy if exists "programs_select_published_or_owner_or_admin" on public.programs;
create policy "programs_select_published_or_owner_or_admin"
  on public.programs for select
  to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or (
      status = 'published'
      and (
        not public.is_recruit()
        or public.is_enrolled_in_program(id)
      )
    )
  );

-- Module access: recruits need enrollment in a linked published program
create or replace function public.can_access_module(p_module_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.program_modules pm
    join public.programs p on p.id = pm.program_id
    where pm.module_id = p_module_id
      and (
        p.created_by = auth.uid()
        or public.is_admin()
        or (
          p.status = 'published'
          and (
            not public.is_recruit()
            or public.is_enrolled_in_module(p_module_id)
          )
        )
      )
  );
$$;

-- Block recruit self-enrollment; staff may enroll anyone
drop policy if exists "enrollments_insert_self_published" on public.enrollments;
create policy "enrollments_insert_self_published"
  on public.enrollments for insert
  to authenticated
  with check (
    (
      user_id = auth.uid()
      and not public.is_recruit()
      and exists (
        select 1 from public.programs p
        where p.id = program_id and p.status = 'published'
      )
    )
    or public.is_instructor()
  );

drop policy if exists "module_enrollments_insert_self_accessible" on public.module_enrollments;
create policy "module_enrollments_insert_self_accessible"
  on public.module_enrollments for insert
  to authenticated
  with check (
    (
      user_id = auth.uid()
      and not public.is_recruit()
      and public.can_access_module(module_id)
    )
    or public.is_instructor()
  );

-- Prevent non-admins from changing role / is_admin via client
create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role or new.is_admin is distinct from old.is_admin then
    if not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
    ) then
      raise exception 'Only system admins can change permission level or admin flag';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged_columns on public.profiles;
create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row
  execute function public.profiles_guard_privileged_columns();
