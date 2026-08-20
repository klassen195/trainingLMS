-- Training vs EMS tracks: document.track, per-track committee/chief members,
-- rename training_committee/training_chief to working_committee/assistant_chief.

alter table public.approval_documents
  drop constraint if exists approval_documents_stage_check;

update public.approval_documents
set current_stage = 'working_committee'
where current_stage = 'training_committee';

update public.approval_documents
set current_stage = 'assistant_chief'
where current_stage = 'training_chief';

alter table public.approval_documents
  add constraint approval_documents_stage_check check (
    current_stage in (
      'creator',
      'working_committee',
      'assistant_chief',
      'policy_holder',
      'fire_chief',
      'approved'
    )
  );

alter table public.approval_documents
  add column if not exists track text;

update public.approval_documents
set track = 'training'
where track is null;

alter table public.approval_documents
  alter column track set not null;

alter table public.approval_documents
  drop constraint if exists approval_documents_track_check;

alter table public.approval_documents
  add constraint approval_documents_track_check check (
    track in ('training', 'ems')
  );

create index if not exists approval_documents_track_idx
  on public.approval_documents (client_id, track);

update public.approval_document_events
set from_stage = 'working_committee'
where from_stage = 'training_committee';

update public.approval_document_events
set from_stage = 'assistant_chief'
where from_stage = 'training_chief';

update public.approval_document_events
set to_stage = 'working_committee'
where to_stage = 'training_committee';

update public.approval_document_events
set to_stage = 'assistant_chief'
where to_stage = 'training_chief';

alter table public.approval_stage_members
  drop constraint if exists approval_stage_members_stage_check;

alter table public.approval_stage_members
  drop constraint if exists approval_stage_members_unique;

update public.approval_stage_members
set stage = 'working_committee'
where stage = 'training_committee';

update public.approval_stage_members
set stage = 'assistant_chief'
where stage = 'training_chief';

alter table public.approval_stage_members
  add column if not exists track text;

update public.approval_stage_members
set track = 'training'
where stage in ('working_committee', 'assistant_chief')
  and track is null;

update public.approval_stage_members
set track = null
where stage = 'fire_chief';

alter table public.approval_stage_members
  add constraint approval_stage_members_stage_check check (
    stage in ('working_committee', 'assistant_chief', 'fire_chief')
  );

alter table public.approval_stage_members
  drop constraint if exists approval_stage_members_stage_track_check;

alter table public.approval_stage_members
  add constraint approval_stage_members_stage_track_check check (
    (stage = 'fire_chief' and track is null)
    or (
      stage in ('working_committee', 'assistant_chief')
      and track in ('training', 'ems')
    )
  );

drop index if exists public.approval_stage_members_tracked_unique;
create unique index approval_stage_members_tracked_unique
  on public.approval_stage_members (client_id, stage, track, profile_id)
  where track is not null;

drop index if exists public.approval_stage_members_shared_unique;
create unique index approval_stage_members_shared_unique
  on public.approval_stage_members (client_id, stage, profile_id)
  where track is null;

create or replace function public.approval_stage_index(p_stage text)
returns integer
language sql
immutable
as $$
  select case p_stage
    when 'creator' then 1
    when 'working_committee' then 2
    when 'assistant_chief' then 3
    when 'policy_holder' then 4
    when 'fire_chief' then 5
    when 'approved' then 6
    else null
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
  doc_client uuid;
  doc_created_by uuid;
  doc_track text;
begin
  if public.is_admin() then
    return true;
  end if;

  select client_id, created_by, track
    into doc_client, doc_created_by, doc_track
  from public.approval_documents
  where id = p_document_id
    and client_id = public.current_client_id();

  if doc_client is null then
    return false;
  end if;

  if p_stage = 'creator' then
    return doc_created_by = auth.uid();
  end if;

  if p_stage in ('working_committee', 'assistant_chief') then
    return exists (
      select 1
      from public.approval_stage_members m
      where m.client_id = doc_client
        and m.stage = p_stage
        and m.track = doc_track
        and m.profile_id = auth.uid()
    );
  end if;

  if p_stage = 'fire_chief' then
    return exists (
      select 1
      from public.approval_stage_members m
      where m.client_id = doc_client
        and m.stage = 'fire_chief'
        and m.track is null
        and m.profile_id = auth.uid()
    );
  end if;

  if p_stage = 'policy_holder' then
    return exists (
      select 1
      from public.approval_document_holders h
      where h.document_id = p_document_id
        and h.profile_id = auth.uid()
    );
  end if;

  return false;
end;
$$;
