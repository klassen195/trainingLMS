-- Multi-day certification course schedules + optional hours override

alter table public.training_sessions
  add column if not exists hours_overridden boolean not null default false;

create table if not exists public.training_session_days (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions (id) on delete cascade,
  occurred_on date not null,
  start_time time not null,
  end_time time not null,
  sort_order integer not null default 0,
  constraint training_session_days_time_order check (end_time > start_time),
  constraint training_session_days_unique_date unique (session_id, occurred_on)
);

create index if not exists training_session_days_session_id_idx
  on public.training_session_days (session_id, sort_order, occurred_on);

-- Backfill one day per existing certification course
insert into public.training_session_days (
  session_id,
  occurred_on,
  start_time,
  end_time,
  sort_order
)
select
  s.id,
  s.started_on,
  coalesce(s.start_time, time '08:00'),
  case
    when s.end_time is not null
      and coalesce(s.start_time, time '08:00') < s.end_time
      then s.end_time
    else (coalesce(s.start_time, time '08:00') + interval '1 hour')::time
  end,
  0
from public.training_sessions s
where s.session_type = 'certification_course'
  and s.started_on is not null
  and not exists (
    select 1
    from public.training_session_days d
    where d.session_id = s.id
  );

-- Avoid a misleading single parent time range on certification courses
update public.training_sessions
set start_time = null, end_time = null
where session_type = 'certification_course';

alter table public.training_session_days enable row level security;

drop policy if exists "training_session_days_select" on public.training_session_days;
create policy "training_session_days_select"
  on public.training_session_days for select
  to authenticated
  using (
    public.has_capability('document_training')
    or exists (
      select 1
      from public.training_session_attendees a
      where a.session_id = training_session_days.session_id
        and a.profile_id = auth.uid()
    )
  );

drop policy if exists "training_session_days_insert" on public.training_session_days;
create policy "training_session_days_insert"
  on public.training_session_days for insert
  to authenticated
  with check (public.has_capability('document_training'));

drop policy if exists "training_session_days_update" on public.training_session_days;
create policy "training_session_days_update"
  on public.training_session_days for update
  to authenticated
  using (public.has_capability('document_training'))
  with check (public.has_capability('document_training'));

drop policy if exists "training_session_days_delete" on public.training_session_days;
create policy "training_session_days_delete"
  on public.training_session_days for delete
  to authenticated
  using (public.has_capability('document_training'));
