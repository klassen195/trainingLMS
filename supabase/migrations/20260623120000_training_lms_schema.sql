-- Training LMS schema
create type public.user_role as enum ('admin', 'instructor', 'learner');
create type public.course_category as enum ('fire', 'engineer', 'officer', 'battalion_chief', 'ems');
create type public.course_status as enum ('draft', 'published', 'archived');
create type public.enrollment_status as enum ('active', 'completed');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role public.user_role not null default 'learner',
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category public.course_category not null,
  status public.course_status not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  content text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.enrollment_status not null default 'active',
  enrolled_at timestamptz not null default now(),
  unique (course_id, user_id)
);

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (lesson_id, user_id)
);

create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null default '',
  submitted_at timestamptz not null default now(),
  unique (assignment_id, user_id)
);

create or replace function public.set_courses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger courses_updated_at
  before update on public.courses
  for each row execute function public.set_courses_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.is_instructor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'instructor')
  );
$$;

create or replace function public.is_enrolled(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.enrollments e
    where e.course_id = p_course_id
      and e.user_id = auth.uid()
      and e.status = 'active'
  );
$$;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.assignments enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.assignment_submissions enable row level security;

create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own_display_name"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_admin_update_roles"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "courses_select_published_or_owner_or_admin"
  on public.courses for select
  to authenticated
  using (
    status = 'published'
    or created_by = auth.uid()
    or public.is_admin()
    or public.is_enrolled(id)
  );

create policy "courses_insert_instructor"
  on public.courses for insert
  to authenticated
  with check (public.is_instructor() and created_by = auth.uid());

create policy "courses_update_owner_or_admin"
  on public.courses for update
  to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

create policy "courses_delete_owner_or_admin"
  on public.courses for delete
  to authenticated
  using (created_by = auth.uid() or public.is_admin());

create policy "lessons_select_if_course_visible"
  on public.lessons for select
  to authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = lessons.course_id
        and (
          c.status = 'published'
          or c.created_by = auth.uid()
          or public.is_admin()
          or public.is_enrolled(c.id)
        )
    )
  );

create policy "lessons_mutate_course_owner"
  on public.lessons for all
  to authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = lessons.course_id and (c.created_by = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.courses c
      where c.id = lessons.course_id and (c.created_by = auth.uid() or public.is_admin())
    )
  );

create policy "assignments_select_if_course_visible"
  on public.assignments for select
  to authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = assignments.course_id
        and (
          c.status = 'published'
          or c.created_by = auth.uid()
          or public.is_admin()
          or public.is_enrolled(c.id)
        )
    )
  );

create policy "assignments_mutate_course_owner"
  on public.assignments for all
  to authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = assignments.course_id and (c.created_by = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.courses c
      where c.id = assignments.course_id and (c.created_by = auth.uid() or public.is_admin())
    )
  );

create policy "enrollments_select_own_or_admin"
  on public.enrollments for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_instructor());

create policy "enrollments_insert_self_published"
  on public.enrollments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.courses c
      where c.id = course_id and c.status = 'published'
    )
  );

create policy "enrollments_update_own"
  on public.enrollments for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "lesson_progress_select_own"
  on public.lesson_progress for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_instructor());

create policy "lesson_progress_insert_own_enrolled"
  on public.lesson_progress for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.lessons l
      join public.enrollments e on e.course_id = l.course_id
      where l.id = lesson_id and e.user_id = auth.uid() and e.status = 'active'
    )
  );

create policy "assignment_submissions_select_own"
  on public.assignment_submissions for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_instructor());

create policy "assignment_submissions_insert_own_enrolled"
  on public.assignment_submissions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.assignments a
      join public.enrollments e on e.course_id = a.course_id
      where a.id = assignment_id and e.user_id = auth.uid() and e.status = 'active'
    )
  );

create policy "assignment_submissions_update_own"
  on public.assignment_submissions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Seed published courses (no created_by — department catalog)
insert into public.courses (id, title, description, category, status, created_by) values
  ('a1000001-0001-4001-8001-000000000001', 'Engine Ops', 'Engine company operations and pump procedures.', 'engineer', 'published', null),
  ('a1000001-0001-4001-8001-000000000002', 'Truck Ops', 'Truck company operations, ventilation, and search.', 'engineer', 'published', null),
  ('a1000001-0001-4001-8001-000000000003', 'Rescue Boat', 'Rescue boat deployment and water rescue basics.', 'fire', 'published', null),
  ('a1000001-0001-4001-8001-000000000004', 'Fire Boat', 'Fire boat operations and marine firefighting.', 'fire', 'published', null),
  ('a1000001-0001-4001-8001-000000000005', 'Tech Rescue', 'Technical rescue awareness and team coordination.', 'fire', 'published', null);

insert into public.lessons (id, course_id, title, content, sort_order) values
  ('b2000001-0001-4001-8001-000000000001', 'a1000001-0001-4001-8001-000000000001', 'Getting Started', 'Review engine layout, pump panel, and pre-response checklist.', 1),
  ('b2000001-0001-4001-8001-000000000002', 'a1000001-0001-4001-8001-000000000002', 'Getting Started', 'Review truck tools, ground ladder basics, and crew assignments.', 1),
  ('b2000001-0001-4001-8001-000000000003', 'a1000001-0001-4001-8001-000000000003', 'Getting Started', 'Review rescue boat equipment, PPE, and launch procedures.', 1),
  ('b2000001-0001-4001-8001-000000000004', 'a1000001-0001-4001-8001-000000000004', 'Getting Started', 'Review fire boat systems, communications, and docking safety.', 1),
  ('b2000001-0001-4001-8001-000000000005', 'a1000001-0001-4001-8001-000000000005', 'Getting Started', 'Review tech rescue categories, PPE, and incident command interface.', 1);

insert into public.assignments (id, course_id, title, description, sort_order) values
  ('c3000001-0001-4001-8001-000000000001', 'a1000001-0001-4001-8001-000000000001', 'Engine Walkthrough', 'Document your engine pre-shift inspection findings.', 1),
  ('c3000001-0001-4001-8001-000000000002', 'a1000001-0001-4001-8001-000000000002', 'Truck Inventory', 'List critical truck tools and their stowed locations.', 1),
  ('c3000001-0001-4001-8001-000000000003', 'a1000001-0001-4001-8001-000000000003', 'Boat Safety Brief', 'Summarize rescue boat safety rules for new crew members.', 1),
  ('c3000001-0001-4001-8001-000000000004', 'a1000001-0001-4001-8001-000000000004', 'Marine Response Plan', 'Outline initial actions for a marina fire response.', 1),
  ('c3000001-0001-4001-8001-000000000005', 'a1000001-0001-4001-8001-000000000005', 'Rescue Scenario', 'Describe roles for a low-angle rope rescue call.', 1);
