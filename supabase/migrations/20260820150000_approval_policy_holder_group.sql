-- Policy holder group is a shared, admin-assigned stage — not per-document, not the creator.

alter table public.approval_stage_members
  drop constraint if exists approval_stage_members_stage_check;

alter table public.approval_stage_members
  add constraint approval_stage_members_stage_check check (
    stage in ('working_committee', 'assistant_chief', 'policy_holder', 'fire_chief')
  );

alter table public.approval_stage_members
  drop constraint if exists approval_stage_members_stage_track_check;

alter table public.approval_stage_members
  add constraint approval_stage_members_stage_track_check check (
    (stage in ('fire_chief', 'policy_holder') and track is null)
    or (
      stage in ('working_committee', 'assistant_chief')
      and track in ('training', 'ems')
    )
  );

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

  if p_stage in ('policy_holder', 'fire_chief') then
    return exists (
      select 1
      from public.approval_stage_members m
      where m.client_id = doc_client
        and m.stage = p_stage
        and m.track is null
        and m.profile_id = auth.uid()
    );
  end if;

  return false;
end;
$$;

create or replace function public.transition_approval_document(
  p_document_id uuid,
  p_to_stage text,
  p_comment text default null
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
begin
  if not public.has_capability('approval_tracker') then
    raise exception 'You do not have permission to perform this action.';
  end if;

  select * into doc
  from public.approval_documents
  where id = p_document_id
    and client_id = public.current_client_id();

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

  perform set_config('app.approval_transition', '1', true);

  update public.approval_documents
  set current_stage = p_to_stage
  where id = doc.id;

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
