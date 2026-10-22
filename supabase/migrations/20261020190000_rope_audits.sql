-- Saved tech rescue audits. Findings note gear that did not meet spec.
-- They do not move inventory.

create table if not exists public.rope_audits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid null references public.profiles (id) on delete set null,
  bag_id uuid null references public.rope_bags (id) on delete set null,
  compartment_id uuid null references public.rope_compartments (id) on delete set null,
  constraint rope_audits_target_check check (
    (bag_id is not null and compartment_id is null)
    or (bag_id is null and compartment_id is not null)
  )
);

create index if not exists rope_audits_bag_idx
  on public.rope_audits (bag_id, created_at desc);
create index if not exists rope_audits_compartment_idx
  on public.rope_audits (compartment_id, created_at desc);

create table if not exists public.rope_audit_findings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  audit_id uuid not null references public.rope_audits (id) on delete cascade,
  bag_id uuid null references public.rope_bags (id) on delete set null,
  gear_type_id uuid null references public.rope_gear_types (id) on delete set null,
  asset_id uuid null references public.assets (id) on delete set null,
  reason text not null,
  quantity integer not null default 1,
  notes text not null default '',
  constraint rope_audit_findings_reason_check check (
    reason in ('missing', 'damaged', 'other')
  ),
  constraint rope_audit_findings_quantity_positive check (quantity >= 1)
);

create index if not exists rope_audit_findings_audit_idx
  on public.rope_audit_findings (audit_id);

create or replace function public.rope_save_audit(
  p_bag_id uuid,
  p_compartment_id uuid,
  p_findings jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_audit uuid;
  v_client uuid;
  v_item jsonb;
  v_bag uuid;
  v_gear uuid;
  v_asset uuid;
  v_reason text;
  v_qty integer;
  v_notes text;
begin
  if not public.has_capability('manage_rope_inventory') then
    raise exception 'You do not have permission to manage tech rescue inventory';
  end if;

  if (p_bag_id is null) = (p_compartment_id is null) then
    raise exception 'Choose a bag or a compartment';
  end if;

  v_client := public.current_client_id();

  if p_bag_id is not null then
    if not exists (
      select 1 from public.rope_bags
      where id = p_bag_id and client_id = v_client and is_loose = false
    ) then
      raise exception 'Bag not found';
    end if;
  elsif not exists (
    select 1 from public.rope_compartments
    where id = p_compartment_id and client_id = v_client
  ) then
    raise exception 'Compartment not found';
  end if;

  if p_findings is null or jsonb_typeof(p_findings) <> 'array' then
    raise exception 'Findings are missing';
  end if;
  if jsonb_array_length(p_findings) > 200 then
    raise exception 'Too many findings';
  end if;

  insert into public.rope_audits (client_id, created_by, bag_id, compartment_id)
  values (v_client, auth.uid(), p_bag_id, p_compartment_id)
  returning id into v_audit;

  for v_item in select value from jsonb_array_elements(p_findings) as t(value)
  loop
    v_bag := nullif(v_item->>'bag_id', '')::uuid;
    v_gear := nullif(v_item->>'gear_type_id', '')::uuid;
    v_asset := nullif(v_item->>'asset_id', '')::uuid;
    v_reason := v_item->>'reason';
    v_qty := (v_item->>'quantity')::integer;
    v_notes := coalesce(v_item->>'notes', '');

    if v_reason not in ('missing', 'damaged', 'other') then
      raise exception 'Unknown audit reason';
    end if;
    if v_qty is null or v_qty < 1 or v_qty > 10000 then
      raise exception 'Quantity must be a whole number from 1 to 10000';
    end if;
    if length(v_notes) > 500 then
      raise exception 'Note must be 500 characters or fewer';
    end if;
    if v_reason = 'other' and length(trim(v_notes)) = 0 then
      raise exception 'Add a note for other findings';
    end if;
    if v_gear is null then
      raise exception 'Choose a gear type';
    end if;

    if p_bag_id is not null then
      if v_bag is distinct from p_bag_id then
        raise exception 'Finding does not belong to this bag';
      end if;
    elsif not exists (
      select 1 from public.rope_bags
      where id = v_bag and compartment_id = p_compartment_id and client_id = v_client
    ) then
      raise exception 'Finding does not belong to this compartment';
    end if;

    if not exists (
      select 1 from public.rope_gear_types
      where id = v_gear and client_id = v_client
    ) then
      raise exception 'Gear type not found';
    end if;

    insert into public.rope_audit_findings (
      client_id, audit_id, bag_id, gear_type_id, asset_id, reason, quantity, notes
    ) values (
      v_client, v_audit, v_bag, v_gear, v_asset, v_reason, v_qty, trim(v_notes)
    );
  end loop;

  return v_audit;
end;
$$;

revoke all on function public.rope_save_audit(uuid, uuid, jsonb) from public;
grant execute on function public.rope_save_audit(uuid, uuid, jsonb) to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['rope_audits', 'rope_audit_findings']
  loop
    execute format('drop trigger if exists set_client_id_default on public.%I', t);
    execute format(
      'create trigger set_client_id_default before insert on public.%I for each row execute function public.set_row_client_id()',
      t
    );
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation on public.%I', t);
    execute format(
      'create policy tenant_isolation on public.%I as restrictive for all to authenticated using (client_id = public.current_client_id()) with check (client_id = public.current_client_id())',
      t
    );
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.rope_can_view())',
      t || '_select',
      t
    );
  end loop;
end $$;

drop policy if exists rope_audits_insert on public.rope_audits;
create policy rope_audits_insert
  on public.rope_audits for insert
  to authenticated
  with check (
    public.has_capability('manage_rope_inventory')
    and created_by = auth.uid()
  );

drop policy if exists rope_audit_findings_insert on public.rope_audit_findings;
create policy rope_audit_findings_insert
  on public.rope_audit_findings for insert
  to authenticated
  with check (public.has_capability('manage_rope_inventory'));
