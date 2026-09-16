-- Each Policy Tracker item has one assigned person (policy owner).

alter table public.approval_documents
  add column if not exists assigned_to uuid references public.profiles (id) on delete restrict;

update public.approval_documents
set assigned_to = created_by
where assigned_to is null;

alter table public.approval_documents
  alter column assigned_to set not null;

create index if not exists approval_documents_assigned_to_idx
  on public.approval_documents (assigned_to);

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
    if new.assigned_to is null then
      new.assigned_to := new.created_by;
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

  if new.assigned_to is null then
    raise exception 'Choose the person assigned this policy.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = new.assigned_to
      and p.client_id = new.client_id
      and coalesce(p.is_platform_operator, false) = false
  ) then
    raise exception 'Assigned person must be a member of this department.';
  end if;

  return new;
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
    return doc.created_by = auth.uid() or doc.assigned_to = auth.uid();
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

  if p_stage = 'policy_holder' then
    if doc.assigned_to = auth.uid() then
      return true;
    end if;
    return exists (
      select 1
      from public.approval_stage_members m
      where m.client_id = doc.client_id
        and m.stage = 'policy_holder'
        and m.track is null
        and m.profile_id = auth.uid()
    );
  end if;

  if p_stage = 'fire_chief' then
    return exists (
      select 1
      from public.approval_stage_members m
      where m.client_id = doc.client_id
        and m.stage = 'fire_chief'
        and m.track is null
        and m.profile_id = auth.uid()
    );
  end if;

  return false;
end;
$$;
