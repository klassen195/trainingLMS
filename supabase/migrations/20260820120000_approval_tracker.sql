-- Approval Tracker: metadata-only document path to approval

alter table public.permission_level_capabilities
  drop constraint if exists permission_level_capabilities_capability_check;

alter table public.permission_level_capabilities
  add constraint permission_level_capabilities_capability_check check (
    capability in (
      'browse_program_catalog',
      'self_enroll',
      'author_training',
      'ems_qi',
      'document_training',
      'view_apparatus',
      'view_all_ppe',
      'submit_vehicle_checks',
      'submit_maintenance',
      'manage_assets',
      'manage_locations',
      'manage_vehicle_check_templates',
      'manage_quiz_banks',
      'resolve_maintenance',
      'manage_users',
      'manage_incidents',
      'view_fleet',
      'approval_tracker'
    )
  );

create table if not exists public.approval_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  title text not null,
  doc_type text not null,
  current_stage text not null default 'creator',
  notes text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  stage_entered_at timestamptz not null default now(),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approval_documents_title_nonempty check (length(trim(title)) > 0),
  constraint approval_documents_type_check check (
    doc_type in ('policy', 'best_practice', 'training_aid')
  ),
  constraint approval_documents_stage_check check (
    current_stage in (
      'creator',
      'training_committee',
      'training_chief',
      'policy_holder',
      'fire_chief',
      'approved'
    )
  )
);

create index if not exists approval_documents_client_id_idx
  on public.approval_documents (client_id);
create index if not exists approval_documents_stage_idx
  on public.approval_documents (client_id, current_stage, archived_at);
create index if not exists approval_documents_created_by_idx
  on public.approval_documents (created_by);

create table if not exists public.approval_stage_members (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  stage text not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint approval_stage_members_stage_check check (
    stage in ('training_committee', 'training_chief', 'fire_chief')
  ),
  constraint approval_stage_members_unique unique (client_id, stage, profile_id)
);

create index if not exists approval_stage_members_client_stage_idx
  on public.approval_stage_members (client_id, stage);
create index if not exists approval_stage_members_profile_idx
  on public.approval_stage_members (profile_id);

create table if not exists public.approval_document_holders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  document_id uuid not null references public.approval_documents (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint approval_document_holders_unique unique (document_id, profile_id)
);

create index if not exists approval_document_holders_document_idx
  on public.approval_document_holders (document_id);
create index if not exists approval_document_holders_client_id_idx
  on public.approval_document_holders (client_id);

create table if not exists public.approval_document_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  document_id uuid not null references public.approval_documents (id) on delete cascade,
  from_stage text,
  to_stage text,
  action text not null,
  comment text,
  acted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint approval_document_events_action_check check (
    action in (
      'created',
      'advanced',
      'kicked_back',
      'approved',
      'archived',
      'unarchived'
    )
  )
);

create index if not exists approval_document_events_document_idx
  on public.approval_document_events (document_id, created_at desc);
create index if not exists approval_document_events_client_id_idx
  on public.approval_document_events (client_id);

create or replace function public.approval_stage_index(p_stage text)
returns integer
language sql
immutable
as $$
  select case p_stage
    when 'creator' then 1
    when 'training_committee' then 2
    when 'training_chief' then 3
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
begin
  if public.is_admin() then
    return true;
  end if;

  select client_id, created_by
    into doc_client, doc_created_by
  from public.approval_documents
  where id = p_document_id
    and client_id = public.current_client_id();

  if doc_client is null then
    return false;
  end if;

  if p_stage = 'creator' then
    return doc_created_by = auth.uid();
  end if;

  if p_stage in ('training_committee', 'training_chief', 'fire_chief') then
    return exists (
      select 1
      from public.approval_stage_members m
      where m.client_id = doc_client
        and m.stage = p_stage
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

drop trigger if exists approval_documents_biu on public.approval_documents;
create trigger approval_documents_biu
  before insert or update on public.approval_documents
  for each row
  execute function public.approval_documents_biu();

drop trigger if exists set_client_id_default on public.approval_documents;
create trigger set_client_id_default
  before insert on public.approval_documents
  for each row
  execute function public.set_row_client_id();

drop trigger if exists set_client_id_default on public.approval_stage_members;
create trigger set_client_id_default
  before insert on public.approval_stage_members
  for each row
  execute function public.set_row_client_id();

drop trigger if exists set_client_id_default on public.approval_document_holders;
create trigger set_client_id_default
  before insert on public.approval_document_holders
  for each row
  execute function public.set_row_client_id();

drop trigger if exists set_client_id_default on public.approval_document_events;
create trigger set_client_id_default
  before insert on public.approval_document_events
  for each row
  execute function public.set_row_client_id();

create or replace function public.approval_documents_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.approval_document_events (
    client_id, document_id, from_stage, to_stage, action, acted_by
  ) values (
    new.client_id, new.id, null, new.current_stage, 'created', new.created_by
  );
  return new;
end;
$$;

drop trigger if exists approval_documents_after_insert on public.approval_documents;
create trigger approval_documents_after_insert
  after insert on public.approval_documents
  for each row
  execute function public.approval_documents_after_insert();

create or replace function public.approval_documents_after_archive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.archived_at is null and new.archived_at is not null then
    insert into public.approval_document_events (
      client_id, document_id, from_stage, to_stage, action, acted_by
    ) values (
      new.client_id, new.id, new.current_stage, new.current_stage, 'archived', auth.uid()
    );
  elsif old.archived_at is not null and new.archived_at is null then
    insert into public.approval_document_events (
      client_id, document_id, from_stage, to_stage, action, acted_by
    ) values (
      new.client_id, new.id, new.current_stage, new.current_stage, 'unarchived', auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists approval_documents_after_archive on public.approval_documents;
create trigger approval_documents_after_archive
  after update of archived_at on public.approval_documents
  for each row
  execute function public.approval_documents_after_archive();

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

  if doc.current_stage = 'creator' and action_name = 'advanced' then
    if not exists (
      select 1
      from public.approval_document_holders h
      where h.document_id = doc.id
    ) then
      raise exception 'Select at least one policy holder before submitting.';
    end if;
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

revoke all on function public.approval_stage_index(text) from public;
revoke all on function public.is_approval_stage_actor(uuid, text) from public;
revoke all on function public.transition_approval_document(uuid, text, text) from public;
grant execute on function public.approval_stage_index(text) to authenticated;
grant execute on function public.is_approval_stage_actor(uuid, text) to authenticated;
grant execute on function public.transition_approval_document(uuid, text, text) to authenticated;

alter table public.approval_documents enable row level security;
alter table public.approval_stage_members enable row level security;
alter table public.approval_document_holders enable row level security;
alter table public.approval_document_events enable row level security;

drop policy if exists tenant_isolation on public.approval_documents;
create policy tenant_isolation on public.approval_documents
  as restrictive for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

drop policy if exists tenant_isolation on public.approval_stage_members;
create policy tenant_isolation on public.approval_stage_members
  as restrictive for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

drop policy if exists tenant_isolation on public.approval_document_holders;
create policy tenant_isolation on public.approval_document_holders
  as restrictive for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

drop policy if exists tenant_isolation on public.approval_document_events;
create policy tenant_isolation on public.approval_document_events
  as restrictive for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

drop policy if exists approval_documents_select on public.approval_documents;
create policy approval_documents_select
  on public.approval_documents for select
  to authenticated
  using (public.has_capability('approval_tracker'));

drop policy if exists approval_documents_insert on public.approval_documents;
create policy approval_documents_insert
  on public.approval_documents for insert
  to authenticated
  with check (
    public.has_capability('approval_tracker')
    and created_by = auth.uid()
  );

drop policy if exists approval_documents_update on public.approval_documents;
create policy approval_documents_update
  on public.approval_documents for update
  to authenticated
  using (public.has_capability('approval_tracker'))
  with check (public.has_capability('approval_tracker'));

drop policy if exists approval_documents_delete on public.approval_documents;
create policy approval_documents_delete
  on public.approval_documents for delete
  to authenticated
  using (
    public.has_capability('approval_tracker')
    and (created_by = auth.uid() or public.is_admin())
  );

drop policy if exists approval_stage_members_select on public.approval_stage_members;
create policy approval_stage_members_select
  on public.approval_stage_members for select
  to authenticated
  using (public.has_capability('approval_tracker') or public.is_admin());

drop policy if exists approval_stage_members_insert on public.approval_stage_members;
create policy approval_stage_members_insert
  on public.approval_stage_members for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists approval_stage_members_delete on public.approval_stage_members;
create policy approval_stage_members_delete
  on public.approval_stage_members for delete
  to authenticated
  using (public.is_admin());

drop policy if exists approval_document_holders_select on public.approval_document_holders;
create policy approval_document_holders_select
  on public.approval_document_holders for select
  to authenticated
  using (public.has_capability('approval_tracker'));

drop policy if exists approval_document_holders_insert on public.approval_document_holders;
create policy approval_document_holders_insert
  on public.approval_document_holders for insert
  to authenticated
  with check (public.has_capability('approval_tracker'));

drop policy if exists approval_document_holders_delete on public.approval_document_holders;
create policy approval_document_holders_delete
  on public.approval_document_holders for delete
  to authenticated
  using (public.has_capability('approval_tracker'));

drop policy if exists approval_document_events_select on public.approval_document_events;
create policy approval_document_events_select
  on public.approval_document_events for select
  to authenticated
  using (public.has_capability('approval_tracker'));

drop policy if exists approval_document_events_insert on public.approval_document_events;
create policy approval_document_events_insert
  on public.approval_document_events for insert
  to authenticated
  with check (public.has_capability('approval_tracker'));
