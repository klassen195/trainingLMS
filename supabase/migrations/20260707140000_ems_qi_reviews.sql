-- EMS call QA/QI review forms
create table public.ems_qi_reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  call_date date,
  call_number text,
  unit text,
  answers jsonb not null default '{}'::jsonb,
  summary_text text not null default '',
  total_score integer,
  max_score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ems_qi_reviews_reviewer_id_idx on public.ems_qi_reviews (reviewer_id);
create index ems_qi_reviews_call_date_idx on public.ems_qi_reviews (call_date desc);
create index ems_qi_reviews_created_at_idx on public.ems_qi_reviews (created_at desc);

create or replace function public.set_ems_qi_reviews_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger ems_qi_reviews_updated_at
  before update on public.ems_qi_reviews
  for each row execute function public.set_ems_qi_reviews_updated_at();

alter table public.ems_qi_reviews enable row level security;

create policy "ems_qi_reviews_select_instructor"
  on public.ems_qi_reviews for select
  to authenticated
  using (public.is_instructor());

create policy "ems_qi_reviews_insert_instructor"
  on public.ems_qi_reviews for insert
  to authenticated
  with check (public.is_instructor() and reviewer_id = auth.uid());

create policy "ems_qi_reviews_update_own_or_admin"
  on public.ems_qi_reviews for update
  to authenticated
  using (reviewer_id = auth.uid() or public.is_admin())
  with check (reviewer_id = auth.uid() or public.is_admin());

create policy "ems_qi_reviews_delete_own_or_admin"
  on public.ems_qi_reviews for delete
  to authenticated
  using (reviewer_id = auth.uid() or public.is_admin());
