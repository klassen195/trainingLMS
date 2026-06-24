-- Quiz question bank, settings, pool, and attempts.

alter table public.module_resources
  drop constraint if exists module_resources_source_check;

alter table public.module_resources
  add constraint module_resources_source_check check (
    (
      resource_type = 'youtube'
      and external_url is not null
      and storage_path is null
    )
    or (
      resource_type = 'quiz'
      and storage_path is null
      and file_name is null
      and external_url is null
    )
    or (
      resource_type not in ('youtube', 'quiz')
      and storage_path is not null
      and file_name is not null
      and external_url is null
    )
  );

create table public.question_bank_items (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  explanation text,
  topic text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.question_bank_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.question_bank_items (id) on delete cascade,
  option_text text not null,
  is_correct boolean not null default false,
  sort_order integer not null default 0
);

create index question_bank_options_question_id_idx on public.question_bank_options (question_id, sort_order);

create table public.quiz_settings (
  resource_id uuid primary key references public.module_resources (id) on delete cascade,
  questions_per_attempt integer not null default 5 check (questions_per_attempt > 0),
  pass_percent integer not null default 80 check (pass_percent > 0 and pass_percent <= 100),
  updated_at timestamptz not null default now()
);

create table public.quiz_pool_questions (
  resource_id uuid not null references public.module_resources (id) on delete cascade,
  question_id uuid not null references public.question_bank_items (id) on delete cascade,
  primary key (resource_id, question_id)
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.module_resources (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  score_percent integer,
  passed boolean,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index quiz_attempts_resource_user_idx on public.quiz_attempts (resource_id, user_id);

create table public.quiz_attempt_questions (
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id uuid not null references public.question_bank_items (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (attempt_id, question_id)
);

create table public.quiz_attempt_answers (
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id uuid not null references public.question_bank_items (id) on delete cascade,
  selected_option_id uuid references public.question_bank_options (id) on delete set null,
  is_correct boolean not null default false,
  primary key (attempt_id, question_id)
);

create or replace function public.can_access_quiz_resource(p_resource_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.module_resources mr
    where mr.id = p_resource_id
      and mr.resource_type = 'quiz'
      and public.can_access_module(mr.module_id)
  );
$$;

alter table public.question_bank_items enable row level security;
alter table public.question_bank_options enable row level security;
alter table public.quiz_settings enable row level security;
alter table public.quiz_pool_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_attempt_questions enable row level security;
alter table public.quiz_attempt_answers enable row level security;

create policy "question_bank_items_select_admin_or_attempt"
  on public.question_bank_items for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.quiz_attempt_questions qaq
      join public.quiz_attempts qa on qa.id = qaq.attempt_id
      where qaq.question_id = question_bank_items.id
        and qa.user_id = auth.uid()
    )
  );

create policy "question_bank_items_mutate_admin"
  on public.question_bank_items for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "question_bank_options_select_admin_or_attempt"
  on public.question_bank_options for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.quiz_attempt_questions qaq
      join public.quiz_attempts qa on qa.id = qaq.attempt_id
      where qaq.question_id = question_bank_options.question_id
        and qa.user_id = auth.uid()
    )
  );

create policy "question_bank_options_mutate_admin"
  on public.question_bank_options for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "quiz_settings_select_if_resource_visible"
  on public.quiz_settings for select
  to authenticated
  using (public.can_access_quiz_resource(resource_id) or public.is_admin());

create policy "quiz_settings_mutate_admin"
  on public.quiz_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "quiz_pool_select_if_resource_visible"
  on public.quiz_pool_questions for select
  to authenticated
  using (public.can_access_quiz_resource(resource_id) or public.is_admin());

create policy "quiz_pool_mutate_admin"
  on public.quiz_pool_questions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "quiz_attempts_select_own_or_staff"
  on public.quiz_attempts for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_instructor());

create policy "quiz_attempts_insert_own_enrolled"
  on public.quiz_attempts for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.can_access_quiz_resource(resource_id)
    and exists (
      select 1
      from public.module_resources mr
      where mr.id = resource_id
        and public.is_enrolled_in_module(mr.module_id)
    )
  );

create policy "quiz_attempts_update_own_incomplete"
  on public.quiz_attempts for update
  to authenticated
  using (user_id = auth.uid() and completed_at is null)
  with check (user_id = auth.uid());

create policy "quiz_attempt_questions_select_own"
  on public.quiz_attempt_questions for select
  to authenticated
  using (
    exists (
      select 1 from public.quiz_attempts qa
      where qa.id = attempt_id and (qa.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "quiz_attempt_questions_insert_own"
  on public.quiz_attempt_questions for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.quiz_attempts qa
      where qa.id = attempt_id
        and qa.user_id = auth.uid()
        and qa.completed_at is null
    )
  );

create policy "quiz_attempt_answers_select_own"
  on public.quiz_attempt_answers for select
  to authenticated
  using (
    exists (
      select 1 from public.quiz_attempts qa
      where qa.id = attempt_id and (qa.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "quiz_attempt_answers_insert_own"
  on public.quiz_attempt_answers for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.quiz_attempts qa
      where qa.id = attempt_id
        and qa.user_id = auth.uid()
        and qa.completed_at is null
    )
  );
