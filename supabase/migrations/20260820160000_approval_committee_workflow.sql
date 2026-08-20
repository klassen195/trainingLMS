-- Policy Tracker: Assistant Chief of Special Projects assigns committees;
-- unanimous committee approval with optional chair override.

select set_config('app.approval_transition', '1', true);

alter table public.approval_documents
  drop constraint if exists approval_documents_stage_check;

alter table public.approval_documents
  add column if not exists committee text;

alter table public.approval_documents
  add column if not exists subcommittee text;

update public.approval_documents
set
  committee = 'operations',
  subcommittee = case when track = 'ems' then 'ems' else 'training' end
where current_stage is distinct from 'creator'
  and track in ('training', 'ems');

update public.approval_documents
set current_stage = 'committee'
where current_stage = 'working_committee';

update public.approval_documents
set current_stage = 'special_projects_review'
where current_stage = 'assistant_chief';

alter table public.approval_documents
  add constraint approval_documents_stage_check check (
    current_stage in (
      'creator',
      'special_projects_intake',
      'committee',
      'special_projects_review',
      'policy_holder',
      'fire_chief',
      'approved'
    )
  );

alter table public.approval_documents
  drop constraint if exists approval_documents_committee_check;

alter table public.approval_documents
  add constraint approval_documents_committee_check check (
    (
      committee is null
      and subcommittee is null
    )
    or (
      committee in ('admin', 'logistics', 'prevention')
      and subcommittee is null
    )
    or (
      committee = 'operations'
      and subcommittee in ('training', 'ems', 'general_operations')
    )
  );

drop index if exists public.approval_documents_track_idx;
create index if not exists approval_documents_committee_idx
  on public.approval_documents (client_id, committee, subcommittee);

alter table public.approval_documents
  drop constraint if exists approval_documents_track_check;

alter table public.approval_documents
  drop column if exists track;

update public.approval_document_events
set from_stage = 'committee'
where from_stage = 'working_committee';

update public.approval_document_events
set from_stage = 'special_projects_review'
where from_stage = 'assistant_chief';

update public.approval_document_events
set to_stage = 'committee'
where to_stage = 'working_committee';

update public.approval_document_events
set to_stage = 'special_projects_review'
where to_stage = 'assistant_chief';

alter table public.approval_document_events
  drop constraint if exists approval_document_events_action_check;

alter table public.approval_document_events
  add constraint approval_document_events_action_check check (
    action in (
      'created',
      'advanced',
      'kicked_back',
      'approved',
      'archived',
      'unarchived',
      'committee_approved'
    )
  );

delete from public.approval_stage_members
where stage in ('working_committee', 'assistant_chief');

alter table public.approval_stage_members
  drop constraint if exists approval_stage_members_stage_check;

alter table public.approval_stage_members
  drop constraint if exists approval_stage_members_stage_track_check;

update public.approval_stage_members
set track = null
where stage in ('policy_holder', 'fire_chief', 'assistant_chief');

alter table public.approval_stage_members
  add constraint approval_stage_members_stage_check check (
    stage in ('assistant_chief', 'policy_holder', 'fire_chief')
  );

alter table public.approval_stage_members
  add constraint approval_stage_members_stage_track_check check (
    track is null
  );

create table if not exists public.approval_committee_members (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  committee text not null,
  subcommittee text,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  is_chair boolean not null default false,
  created_at timestamptz not null default now(),
  constraint approval_committee_members_body_check check (
    (
      committee in ('admin', 'logistics', 'prevention')
      and subcommittee is null
    )
    or (
      committee = 'operations'
      and subcommittee in ('training', 'ems', 'general_operations')
    )
  )
);

create index if not exists approval_committee_members_client_idx
  on public.approval_committee_members (client_id, committee, subcommittee);

create index if not exists approval_committee_members_profile_idx
  on public.approval_committee_members (profile_id);

drop index if exists public.approval_committee_members_tracked_unique;
create unique index approval_committee_members_tracked_unique
  on public.approval_committee_members (client_id, committee, subcommittee, profile_id)
  where subcommittee is not null;

drop index if exists public.approval_committee_members_shared_unique;
create unique index approval_committee_members_shared_unique
  on public.approval_committee_members (client_id, committee, profile_id)
  where subcommittee is null;

drop index if exists public.approval_committee_members_chair_tracked;
create unique index approval_committee_members_chair_tracked
  on public.approval_committee_members (client_id, committee, subcommittee)
  where is_chair and subcommittee is not null;

drop index if exists public.approval_committee_members_chair_shared;
create unique index approval_committee_members_chair_shared
  on public.approval_committee_members (client_id, committee)
  where is_chair and subcommittee is null;

create table if not exists public.approval_document_committee_votes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  document_id uuid not null references public.approval_documents (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint approval_document_committee_votes_unique unique (document_id, profile_id)
);

create index if not exists approval_document_committee_votes_document_idx
  on public.approval_document_committee_votes (document_id);

create index if not exists approval_document_committee_votes_client_idx
  on public.approval_document_committee_votes (client_id);

drop trigger if exists set_client_id_default on public.approval_committee_members;
create trigger set_client_id_default
  before insert on public.approval_committee_members
  for each row
  execute function public.set_row_client_id();

drop trigger if exists set_client_id_default on public.approval_document_committee_votes;
create trigger set_client_id_default
  before insert on public.approval_document_committee_votes
  for each row
  execute function public.set_row_client_id();

create or replace function public.approval_documents_biu()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is null then
      new.created_by := auth.uid();
    end if;
    if new.current_stage is distinct from 'creator' then
      raise exception 'New documents must start at the document creator stage.';
    end if;
    new.archived_at := null;
    new.stage_entered_at := coalesce(new.stage_entered_at, now());
  end if;

  if tg_op = 'UPDATE' then
    if new.created_by is distinct from old.created_by then
      raise exception 'Document creator cannot be changed.';
    end if;
    if new.current_stage is distinct from old.current_stage then
      if coalesce(current_setting('app.approval_transition', true), '') <> '1' then
        raise exception 'Stage changes must use transition_approval_document.';
      end if;
      new.stage_entered_at := now();
    end if;
    if new.committee is distinct from old.committee
      or new.subcommittee is distinct from old.subcommittee then
      if coalesce(current_setting('app.approval_transition', true), '') <> '1' then
        raise exception 'Committee assignment must use transition_approval_document.';
      end if;
    end if;
    if new.archived_at is distinct from old.archived_at then
      if new.current_stage <> 'approved' then
        raise exception 'Only approved documents can be archived.';
      end if;
    end if;
    new.updated_at := now();
  end if;

  return new;
end;
$$;

create or replace function public.approval_stage_index(p_stage text)
returns integer
language sql
immutable
as $$
  select case p_stage
    when 'creator' then 1
    when 'special_projects_intake' then 2
    when 'committee' then 3
    when 'special_projects_review' then 4
    when 'policy_holder' then 5
    when 'fire_chief' then 6
    when 'approved' then 7
    else null
  end;
$$;

create or replace function public.is_approval_committee_member(
  p_client_id uuid,
  p_committee text,
  p_subcommittee text,
  p_profile_id uuid
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.approval_committee_members m
    where m.client_id = p_client_id
      and m.committee = p_committee
      and m.profile_id = p_profile_id
      and (
        (m.subcommittee is null and p_subcommittee is null)
        or m.subcommittee is not distinct from p_subcommittee
      )
  );
$$;

create or replace function public.is_approval_committee_chair(
  p_client_id uuid,
  p_committee text,
  p_subcommittee text,
  p_profile_id uuid
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.approval_committee_members m
    where m.client_id = p_client_id
      and m.committee = p_committee
      and m.profile_id = p_profile_id
      and m.is_chair
      and (
        (m.subcommittee is null and p_subcommittee is null)
        or m.subcommittee is not distinct from p_subcommittee
      )
  );
$$;

create or replace function public.approval_committee_unanimous(p_document_id uuid)
returns boolean
language plpgsql
stable
as $$
declare
  doc public.approval_documents%rowtype;
  member_count integer;
  vote_count integer;
begin
  select * into doc
  from public.approval_documents
  where id = p_document_id;

  if not found or doc.committee is null then
    return false;
  end if;

  select count(*) into member_count
  from public.approval_committee_members m
  where m.client_id = doc.client_id
    and m.committee = doc.committee
    and (
      (m.subcommittee is null and doc.subcommittee is null)
      or m.subcommittee is not distinct from doc.subcommittee
    );

  if member_count = 0 then
    return false;
  end if;

  select count(*) into vote_count
  from public.approval_document_committee_votes v
  where v.document_id = doc.id
    and exists (
      select 1
      from public.approval_committee_members m
      where m.client_id = doc.client_id
        and m.committee = doc.committee
        and m.profile_id = v.profile_id
        and (
          (m.subcommittee is null and doc.subcommittee is null)
          or m.subcommittee is not distinct from doc.subcommittee
        )
    );

  return vote_count >= member_count;
end;
$$;

create or replace function public.is_approval_stage_actor(p_document_id uuid, p_stage text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  doc public.approval_documents%rowtype;
begin
  if public.is_admin() then
    return true;
  end if;

  select * into doc
  from public.approval_documents
  where id = p_document_id
    and client_id = public.current_client_id();

  if not found then
    return false;
  end if;

  if p_stage = 'creator' then
    return doc.created_by = auth.uid();
  end if;

  if p_stage in ('special_projects_intake', 'special_projects_review') then
    return exists (
      select 1
      from public.approval_stage_members m
      where m.client_id = doc.client_id
        and m.stage = 'assistant_chief'
        and m.track is null
        and m.profile_id = auth.uid()
    );
  end if;

  if p_stage = 'committee' then
    if doc.committee is null then
      return false;
    end if;
    return public.is_approval_committee_member(
      doc.client_id,
      doc.committee,
      doc.subcommittee,
      auth.uid()
    );
  end if;

  if p_stage in ('policy_holder', 'fire_chief') then
    return exists (
      select 1
      from public.approval_stage_members m
      where m.client_id = doc.client_id
        and m.stage = p_stage
        and m.track is null
        and m.profile_id = auth.uid()
    );
  end if;

  return false;
end;
$$;

drop function if exists public.transition_approval_document(uuid, text, text);

create or replace function public.transition_approval_document(
  p_document_id uuid,
  p_to_stage text,
  p_comment text default null,
  p_committee text default null,
  p_subcommittee text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  doc public.approval_documents%rowtype;
  from_idx integer;
  to_idx integer;
  action_name text;
  comment_text text;
  next_committee text;
  next_subcommittee text;
  member_count integer;
begin
  if not public.has_capability('approval_tracker') then
    raise exception 'You do not have permission to perform this action.';
  end if;

  select * into doc
  from public.approval_documents
  where id = p_document_id
    and client_id = public.current_client_id()
  for update;

  if not found then
    raise exception 'Document not found.';
  end if;

  if doc.archived_at is not null then
    raise exception 'Archived documents cannot change stage.';
  end if;

  if doc.current_stage = 'approved' then
    raise exception 'Approved documents cannot change stage.';
  end if;

  if not public.is_approval_stage_actor(p_document_id, doc.current_stage) then
    raise exception 'Only the current stage can move this document.';
  end if;

  from_idx := public.approval_stage_index(doc.current_stage);
  to_idx := public.approval_stage_index(p_to_stage);

  if to_idx is null then
    raise exception 'Invalid target stage.';
  end if;

  if p_to_stage = doc.current_stage then
    raise exception 'Document is already at that stage.';
  end if;

  comment_text := nullif(btrim(coalesce(p_comment, '')), '');
  next_committee := doc.committee;
  next_subcommittee := doc.subcommittee;

  if to_idx > from_idx then
    if to_idx <> from_idx + 1 then
      raise exception 'Documents can only advance one stage at a time.';
    end if;
    if p_to_stage = 'approved' then
      action_name := 'approved';
    else
      action_name := 'advanced';
    end if;
  else
    if p_to_stage = 'approved' then
      raise exception 'Cannot kick a document back to approved.';
    end if;
    if comment_text is null then
      raise exception 'A comment is required when kicking a document back.';
    end if;
    action_name := 'kicked_back';
  end if;

  if doc.current_stage = 'special_projects_intake' and action_name = 'advanced' then
    next_committee := nullif(btrim(coalesce(p_committee, '')), '');
    next_subcommittee := nullif(btrim(coalesce(p_subcommittee, '')), '');

    if next_committee is null then
      raise exception 'Choose a committee.';
    end if;

    if next_committee = 'operations' then
      if next_subcommittee is null or next_subcommittee not in ('training', 'ems', 'general_operations') then
        raise exception 'Choose an Operations subcommittee.';
      end if;
    else
      if next_committee not in ('admin', 'logistics', 'prevention') then
        raise exception 'Choose a committee.';
      end if;
      next_subcommittee := null;
    end if;

    select count(*) into member_count
    from public.approval_committee_members m
    where m.client_id = doc.client_id
      and m.committee = next_committee
      and (
        (m.subcommittee is null and next_subcommittee is null)
        or m.subcommittee is not distinct from next_subcommittee
      );

    if member_count = 0 then
      raise exception 'That committee has no members assigned.';
    end if;
  end if;

  if doc.current_stage = 'committee' and action_name = 'advanced' then
    if not public.is_admin()
      and not public.is_approval_committee_chair(
        doc.client_id,
        doc.committee,
        doc.subcommittee,
        auth.uid()
      )
      and not public.approval_committee_unanimous(doc.id)
    then
      raise exception 'Every committee member must approve, or the chair can send it forward.';
    end if;
  end if;

  perform set_config('app.approval_transition', '1', true);

  update public.approval_documents
  set
    current_stage = p_to_stage,
    committee = next_committee,
    subcommittee = next_subcommittee
  where id = doc.id;

  if doc.current_stage = 'committee' then
    delete from public.approval_document_committee_votes
    where document_id = doc.id;
  end if;

  insert into public.approval_document_events (
    client_id, document_id, from_stage, to_stage, action, comment, acted_by
  ) values (
    doc.client_id,
    doc.id,
    doc.current_stage,
    p_to_stage,
    action_name,
    comment_text,
    auth.uid()
  );
end;
$$;

create or replace function public.record_approval_committee_vote(p_document_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  doc public.approval_documents%rowtype;
  advanced boolean := false;
begin
  if not public.has_capability('approval_tracker') then
    raise exception 'You do not have permission to perform this action.';
  end if;

  select * into doc
  from public.approval_documents
  where id = p_document_id
    and client_id = public.current_client_id()
  for update;

  if not found then
    raise exception 'Document not found.';
  end if;

  if doc.archived_at is not null then
    raise exception 'Archived documents cannot change stage.';
  end if;

  if doc.current_stage <> 'committee' then
    raise exception 'Only the assigned committee can approve at this stage.';
  end if;

  if not public.is_approval_stage_actor(p_document_id, 'committee') then
    raise exception 'Only the assigned committee can approve this document.';
  end if;

  if public.is_admin()
    and not public.is_approval_committee_member(
      doc.client_id,
      doc.committee,
      doc.subcommittee,
      auth.uid()
    )
  then
    raise exception 'Admins can send the document forward as chair instead of recording a member vote.';
  end if;

  insert into public.approval_document_committee_votes (
    client_id, document_id, profile_id
  ) values (
    doc.client_id,
    doc.id,
    auth.uid()
  )
  on conflict (document_id, profile_id) do nothing;

  if found then
    insert into public.approval_document_events (
      client_id, document_id, from_stage, to_stage, action, comment, acted_by
    ) values (
      doc.client_id,
      doc.id,
      'committee',
      'committee',
      'committee_approved',
      null,
      auth.uid()
    );
  end if;

  if public.approval_committee_unanimous(doc.id) then
    perform public.transition_approval_document(doc.id, 'special_projects_review', null, null, null);
    advanced := true;
  end if;

  return advanced;
end;
$$;

revoke all on function public.approval_stage_index(text) from public;
revoke all on function public.is_approval_stage_actor(uuid, text) from public;
revoke all on function public.transition_approval_document(uuid, text, text, text, text) from public;
revoke all on function public.record_approval_committee_vote(uuid) from public;
revoke all on function public.is_approval_committee_member(uuid, text, text, uuid) from public;
revoke all on function public.is_approval_committee_chair(uuid, text, text, uuid) from public;
revoke all on function public.approval_committee_unanimous(uuid) from public;

grant execute on function public.approval_stage_index(text) to authenticated;
grant execute on function public.is_approval_stage_actor(uuid, text) to authenticated;
grant execute on function public.transition_approval_document(uuid, text, text, text, text) to authenticated;
grant execute on function public.record_approval_committee_vote(uuid) to authenticated;

alter table public.approval_committee_members enable row level security;
alter table public.approval_document_committee_votes enable row level security;

drop policy if exists tenant_isolation on public.approval_committee_members;
create policy tenant_isolation on public.approval_committee_members
  as restrictive for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

drop policy if exists tenant_isolation on public.approval_document_committee_votes;
create policy tenant_isolation on public.approval_document_committee_votes
  as restrictive for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

drop policy if exists approval_committee_members_select on public.approval_committee_members;
create policy approval_committee_members_select
  on public.approval_committee_members for select
  to authenticated
  using (public.has_capability('approval_tracker') or public.is_admin());

drop policy if exists approval_committee_members_insert on public.approval_committee_members;
create policy approval_committee_members_insert
  on public.approval_committee_members for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists approval_committee_members_update on public.approval_committee_members;
create policy approval_committee_members_update
  on public.approval_committee_members for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists approval_committee_members_delete on public.approval_committee_members;
create policy approval_committee_members_delete
  on public.approval_committee_members for delete
  to authenticated
  using (public.is_admin());

drop policy if exists approval_document_committee_votes_select on public.approval_document_committee_votes;
create policy approval_document_committee_votes_select
  on public.approval_document_committee_votes for select
  to authenticated
  using (public.has_capability('approval_tracker'));
