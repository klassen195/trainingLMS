-- Policy Tracker: backlog of policy ideas that nobody has taken on yet.
-- Assigning an idea creates an approval_documents row at the creator stage and removes the idea.

create table if not exists public.approval_policy_ideas (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  title text not null,
  doc_type text not null default 'policy',
  notes text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approval_policy_ideas_title_nonempty check (length(trim(title)) > 0),
  constraint approval_policy_ideas_type_check check (
    doc_type in ('policy', 'best_practice', 'training_aid')
  )
);

create index if not exists approval_policy_ideas_client_id_idx
  on public.approval_policy_ideas (client_id, created_at);
create index if not exists approval_policy_ideas_created_by_idx
  on public.approval_policy_ideas (created_by);

drop trigger if exists set_client_id_default on public.approval_policy_ideas;
create trigger set_client_id_default
  before insert on public.approval_policy_ideas
  for each row
  execute function public.set_row_client_id();

create or replace function public.approval_policy_ideas_biu()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is null then
      new.created_by := auth.uid();
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.created_by is distinct from old.created_by then
      raise exception 'Idea creator cannot be changed.';
    end if;
    new.updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists approval_policy_ideas_biu on public.approval_policy_ideas;
create trigger approval_policy_ideas_biu
  before insert or update on public.approval_policy_ideas
  for each row
  execute function public.approval_policy_ideas_biu();

alter table public.approval_policy_ideas enable row level security;

drop policy if exists tenant_isolation on public.approval_policy_ideas;
create policy tenant_isolation on public.approval_policy_ideas
  as restrictive for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

drop policy if exists approval_policy_ideas_select on public.approval_policy_ideas;
create policy approval_policy_ideas_select
  on public.approval_policy_ideas for select
  to authenticated
  using (public.has_capability('approval_tracker'));

drop policy if exists approval_policy_ideas_insert on public.approval_policy_ideas;
create policy approval_policy_ideas_insert
  on public.approval_policy_ideas for insert
  to authenticated
  with check (
    public.has_capability('approval_tracker')
    and created_by = auth.uid()
  );

drop policy if exists approval_policy_ideas_update on public.approval_policy_ideas;
create policy approval_policy_ideas_update
  on public.approval_policy_ideas for update
  to authenticated
  using (
    public.has_capability('approval_tracker')
    and (created_by = auth.uid() or public.is_admin())
  )
  with check (
    public.has_capability('approval_tracker')
    and (created_by = auth.uid() or public.is_admin())
  );

drop policy if exists approval_policy_ideas_delete on public.approval_policy_ideas;
create policy approval_policy_ideas_delete
  on public.approval_policy_ideas for delete
  to authenticated
  using (
    public.has_capability('approval_tracker')
    and (created_by = auth.uid() or public.is_admin())
  );

create or replace function public.assign_approval_policy_idea(
  p_idea_id uuid,
  p_assigned_to uuid,
  p_submission_kind text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  idea public.approval_policy_ideas%rowtype;
  new_id uuid;
begin
  if not public.has_capability('approval_tracker') then
    raise exception 'You do not have permission to perform this action.';
  end if;

  if p_submission_kind is null or p_submission_kind not in ('new', 'replacement') then
    raise exception 'Choose whether this is a new document or a replacement.';
  end if;

  select * into idea
  from public.approval_policy_ideas
  where id = p_idea_id
    and client_id = public.current_client_id()
  for update;

  if not found then
    raise exception 'Policy idea not found.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_assigned_to
      and p.client_id = idea.client_id
      and p.is_active
      and coalesce(p.is_platform_operator, false) = false
  ) then
    raise exception 'Choose an active person in this department.';
  end if;

  insert into public.approval_documents (
    client_id, title, doc_type, submission_kind, notes, created_by, assigned_to, current_stage
  ) values (
    idea.client_id,
    idea.title,
    idea.doc_type,
    p_submission_kind,
    idea.notes,
    auth.uid(),
    p_assigned_to,
    'creator'
  )
  returning id into new_id;

  delete from public.approval_policy_ideas where id = idea.id;

  return new_id;
end;
$$;

revoke all on function public.assign_approval_policy_idea(uuid, uuid, text) from public;
grant execute on function public.assign_approval_policy_idea(uuid, uuid, text) to authenticated;
