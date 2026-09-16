-- Allow archiving a Policy Tracker item from any stage, not only after approval.

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
      if old.archived_at is null
        and new.archived_at is not null
        and new.current_stage <> 'approved'
        and not public.is_approval_stage_actor(new.id, new.current_stage) then
        raise exception 'Only the current stage can archive this document.';
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
