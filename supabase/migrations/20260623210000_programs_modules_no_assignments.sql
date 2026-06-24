-- Upgrade existing course/lesson schema to programs/modules and remove assignments.
-- Safe to run once on databases created from the original migration.

alter table public.profiles
  add column if not exists rank text,
  add column if not exists email text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is null or p.email <> u.email);

drop table if exists public.assignment_submissions cascade;
drop table if exists public.assignments cascade;

do $$
begin
  if exists (select 1 from pg_type where typname = 'course_category') then
    alter type public.course_category rename to program_category;
  end if;
  if exists (select 1 from pg_type where typname = 'course_status') then
    alter type public.course_status rename to program_status;
  end if;
end $$;

do $$
begin
  if to_regclass('public.courses') is not null and to_regclass('public.programs') is null then
    alter table public.courses rename to programs;
  end if;
  if to_regclass('public.lessons') is not null and to_regclass('public.modules') is null then
    alter table public.lessons rename to modules;
  end if;
  if to_regclass('public.lesson_progress') is not null and to_regclass('public.module_progress') is null then
    alter table public.lesson_progress rename to module_progress;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'modules' and column_name = 'course_id'
  ) then
    alter table public.modules rename column course_id to program_id;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'enrollments' and column_name = 'course_id'
  ) then
    alter table public.enrollments rename column course_id to program_id;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'module_progress' and column_name = 'lesson_id'
  ) then
    alter table public.module_progress rename column lesson_id to module_id;
  end if;
end $$;

drop trigger if exists courses_updated_at on public.programs;
drop function if exists public.set_courses_updated_at();

create or replace function public.set_programs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists programs_updated_at on public.programs;
create trigger programs_updated_at
  before update on public.programs
  for each row execute function public.set_programs_updated_at();

-- Drop legacy policies before replacing is_enrolled (policies depend on the function).
drop policy if exists "courses_select_published_or_owner_or_admin" on public.programs;
drop policy if exists "courses_insert_instructor" on public.programs;
drop policy if exists "courses_update_owner_or_admin" on public.programs;
drop policy if exists "courses_delete_owner_or_admin" on public.programs;
drop policy if exists "lessons_select_if_course_visible" on public.modules;
drop policy if exists "lessons_mutate_course_owner" on public.modules;
drop policy if exists "lesson_progress_select_own" on public.module_progress;
drop policy if exists "lesson_progress_insert_own_enrolled" on public.module_progress;

drop policy if exists "programs_select_published_or_owner_or_admin" on public.programs;
drop policy if exists "programs_insert_instructor" on public.programs;
drop policy if exists "programs_update_owner_or_admin" on public.programs;
drop policy if exists "programs_delete_owner_or_admin" on public.programs;
drop policy if exists "modules_select_if_program_visible" on public.modules;
drop policy if exists "modules_mutate_program_owner" on public.modules;
drop policy if exists "module_progress_select_own" on public.module_progress;
drop policy if exists "module_progress_insert_own_enrolled" on public.module_progress;

drop function if exists public.is_enrolled(uuid);
create or replace function public.is_enrolled(p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.enrollments e
    where e.program_id = p_program_id
      and e.user_id = auth.uid()
      and e.status = 'active'
  );
$$;

create policy "programs_select_published_or_owner_or_admin"
  on public.programs for select
  to authenticated
  using (
    status = 'published'
    or created_by = auth.uid()
    or public.is_admin()
    or public.is_enrolled(id)
  );

create policy "programs_insert_instructor"
  on public.programs for insert
  to authenticated
  with check (public.is_instructor() and created_by = auth.uid());

create policy "programs_update_owner_or_admin"
  on public.programs for update
  to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

create policy "programs_delete_owner_or_admin"
  on public.programs for delete
  to authenticated
  using (created_by = auth.uid() or public.is_admin());

create policy "modules_select_if_program_visible"
  on public.modules for select
  to authenticated
  using (
    exists (
      select 1 from public.programs p
      where p.id = modules.program_id
        and (
          p.status = 'published'
          or p.created_by = auth.uid()
          or public.is_admin()
          or public.is_enrolled(p.id)
        )
    )
  );

create policy "modules_mutate_program_owner"
  on public.modules for all
  to authenticated
  using (
    exists (
      select 1 from public.programs p
      where p.id = modules.program_id and (p.created_by = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.programs p
      where p.id = modules.program_id and (p.created_by = auth.uid() or public.is_admin())
    )
  );

create policy "module_progress_select_own"
  on public.module_progress for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_instructor());

create policy "module_progress_insert_own_enrolled"
  on public.module_progress for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.modules m
      join public.enrollments e on e.program_id = m.program_id
      where m.id = module_id and e.user_id = auth.uid() and e.status = 'active'
    )
  );

-- Refresh enrollment insert policy for renamed column
drop policy if exists "enrollments_insert_self_published" on public.enrollments;
create policy "enrollments_insert_self_published"
  on public.enrollments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.programs p
      where p.id = program_id and p.status = 'published'
    )
  );
