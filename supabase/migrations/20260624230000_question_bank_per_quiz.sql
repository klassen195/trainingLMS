-- Scope question bank items to a single quiz resource (one bank per quiz).

alter table public.question_bank_items
  add column resource_id uuid references public.module_resources (id) on delete cascade;

-- Assign existing questions to a quiz when they appear in that quiz's pool.
-- If a question was shared across multiple quizzes, it is kept on the first pool only.
update public.question_bank_items q
set resource_id = (
  select qp.resource_id
  from public.quiz_pool_questions qp
  where qp.question_id = q.id
  order by qp.resource_id
  limit 1
);

delete from public.question_bank_items where resource_id is null;

alter table public.question_bank_items
  alter column resource_id set not null;

create index question_bank_items_resource_id_idx on public.question_bank_items (resource_id, created_at desc);

drop table public.quiz_pool_questions;

drop policy if exists "question_bank_items_select_admin_or_attempt" on public.question_bank_items;
drop policy if exists "question_bank_items_mutate_admin" on public.question_bank_items;

create policy "question_bank_items_select_admin_or_attempt"
  on public.question_bank_items for select
  to authenticated
  using (
    public.is_admin()
    or public.can_access_quiz_resource(resource_id)
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
  with check (
    public.is_admin()
    and exists (
      select 1
      from public.module_resources mr
      where mr.id = resource_id
        and mr.resource_type = 'quiz'
    )
  );
