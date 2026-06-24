-- Training LMS schema
create type public.user_role as enum ('admin', 'instructor', 'learner');
create type public.program_category as enum ('fire', 'engineer', 'officer', 'battalion_chief', 'ems');
create type public.program_status as enum ('draft', 'published', 'archived');
create type public.enrollment_status as enum ('active', 'completed');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  email text,
  rank text,
  role public.user_role not null default 'learner',
  created_at timestamptz not null default now()
);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category public.program_category not null,
  status public.program_status not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  title text not null,
  content text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.enrollment_status not null default 'active',
  enrolled_at timestamptz not null default now(),
  unique (program_id, user_id)
);

create table public.module_progress (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (module_id, user_id)
);

create or replace function public.set_programs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger programs_updated_at
  before update on public.programs
  for each row execute function public.set_programs_updated_at();

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

alter table public.profiles enable row level security;
alter table public.programs enable row level security;
alter table public.modules enable row level security;
alter table public.enrollments enable row level security;
alter table public.module_progress enable row level security;

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
      select 1 from public.programs p
      where p.id = program_id and p.status = 'published'
    )
  );

create policy "enrollments_update_own"
  on public.enrollments for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

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

-- Seed published programs (no created_by — department catalog)
insert into public.programs (id, title, description, category, status, created_by) values
  ('a1000001-0001-4001-8001-000000000001', 'Engine Ops', 'Engine company operations and pump procedures.', 'engineer', 'published', null),
  ('a1000001-0001-4001-8001-000000000002', 'Truck Ops', 'Truck company operations, ventilation, and search.', 'engineer', 'published', null),
  ('a1000001-0001-4001-8001-000000000003', 'Rescue Boat', 'Rescue boat deployment and water rescue basics.', 'fire', 'published', null),
  ('a1000001-0001-4001-8001-000000000004', 'Fire Boat', 'Fire boat operations and marine firefighting.', 'fire', 'published', null),
  ('a1000001-0001-4001-8001-000000000005', 'Tech Rescue', 'Technical rescue awareness and team coordination.', 'fire', 'published', null);

insert into public.modules (id, program_id, title, content, sort_order) values
  ('b2000001-0001-4001-8001-000000000001', 'a1000001-0001-4001-8001-000000000001', 'Getting Started', 'Review engine layout, pump panel, and pre-response checklist.', 1),
  ('b2000001-0001-4001-8001-000000000002', 'a1000001-0001-4001-8001-000000000002', 'Getting Started', 'Review truck tools, ground ladder basics, and crew assignments.', 1),
  ('b2000001-0001-4001-8001-000000000003', 'a1000001-0001-4001-8001-000000000003', 'Getting Started', 'Review rescue boat equipment, PPE, and launch procedures.', 1),
  ('b2000001-0001-4001-8001-000000000004', 'a1000001-0001-4001-8001-000000000004', 'Getting Started', 'Review fire boat systems, communications, and docking safety.', 1),
  ('b2000001-0001-4001-8001-000000000005', 'a1000001-0001-4001-8001-000000000005', 'Getting Started', 'Review tech rescue categories, PPE, and incident command interface.', 1);
