-- Vehicle checks: admin-editable Daily/Weekly templates + firefighter submissions on apparatus
-- Template is one ordered list: section headers + checklist items (each daily or weekly).

do $$
begin
  if not exists (select 1 from pg_type where typname = 'vehicle_check_type') then
    create type public.vehicle_check_type as enum ('daily', 'weekly');
  end if;

  if not exists (select 1 from pg_type where typname = 'vehicle_check_template_row_kind') then
    create type public.vehicle_check_template_row_kind as enum ('section', 'item');
  end if;

  if not exists (select 1 from pg_type where typname = 'vehicle_check_item_result') then
    create type public.vehicle_check_item_result as enum (
      'pass',
      'fail',
      'needs_attention',
      'not_applicable'
    );
  end if;
end $$;

create table if not exists public.vehicle_check_template_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  row_kind public.vehicle_check_template_row_kind not null default 'item',
  check_type public.vehicle_check_type null,
  label text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  constraint vehicle_check_template_items_label_check check (char_length(trim(label)) > 0),
  constraint vehicle_check_template_items_kind_check check (
    (row_kind = 'section' and check_type is null)
    or (row_kind = 'item' and check_type is not null)
  )
);

create index if not exists vehicle_check_template_items_sort_idx
  on public.vehicle_check_template_items (sort_order);

create table if not exists public.vehicle_checks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  checked_at timestamptz not null default now(),
  checked_by uuid null references public.profiles (id) on delete set null,
  includes_daily boolean not null default false,
  includes_weekly boolean not null default false,
  notes text not null default '',
  constraint vehicle_checks_includes_check check (includes_daily or includes_weekly)
);

create index if not exists vehicle_checks_asset_id_idx on public.vehicle_checks (asset_id);
create index if not exists vehicle_checks_checked_at_idx on public.vehicle_checks (checked_at desc);
create index if not exists vehicle_checks_asset_checked_at_idx
  on public.vehicle_checks (asset_id, checked_at desc);

create table if not exists public.vehicle_check_responses (
  id uuid primary key default gen_random_uuid(),
  vehicle_check_id uuid not null references public.vehicle_checks (id) on delete cascade,
  check_type public.vehicle_check_type not null,
  label text not null,
  section_title text null,
  sort_order integer not null default 0,
  result public.vehicle_check_item_result not null,
  notes text not null default '',
  constraint vehicle_check_responses_label_check check (char_length(trim(label)) > 0)
);

create index if not exists vehicle_check_responses_check_id_idx
  on public.vehicle_check_responses (vehicle_check_id);

-- Ensure vehicle checks only attach to apparatus assets
create or replace function public.vehicle_checks_require_apparatus()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.assets a where a.id = new.asset_id and a.kind = 'apparatus'
  ) then
    raise exception 'Vehicle checks can only be logged on apparatus assets';
  end if;
  return new;
end;
$$;

drop trigger if exists vehicle_checks_require_apparatus on public.vehicle_checks;
create trigger vehicle_checks_require_apparatus
  before insert or update of asset_id on public.vehicle_checks
  for each row execute function public.vehicle_checks_require_apparatus();

alter table public.vehicle_check_template_items enable row level security;
alter table public.vehicle_checks enable row level security;
alter table public.vehicle_check_responses enable row level security;

drop policy if exists "vehicle_check_template_items_select" on public.vehicle_check_template_items;
drop policy if exists "vehicle_check_template_items_insert_admin" on public.vehicle_check_template_items;
drop policy if exists "vehicle_check_template_items_update_admin" on public.vehicle_check_template_items;
drop policy if exists "vehicle_check_template_items_delete_admin" on public.vehicle_check_template_items;

create policy "vehicle_check_template_items_select"
  on public.vehicle_check_template_items for select
  to authenticated
  using (true);

create policy "vehicle_check_template_items_insert_admin"
  on public.vehicle_check_template_items for insert
  to authenticated
  with check (public.is_admin());

create policy "vehicle_check_template_items_update_admin"
  on public.vehicle_check_template_items for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "vehicle_check_template_items_delete_admin"
  on public.vehicle_check_template_items for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "vehicle_checks_select" on public.vehicle_checks;
drop policy if exists "vehicle_checks_insert" on public.vehicle_checks;
drop policy if exists "vehicle_checks_update_own" on public.vehicle_checks;
drop policy if exists "vehicle_checks_delete_admin" on public.vehicle_checks;

create policy "vehicle_checks_select"
  on public.vehicle_checks for select
  to authenticated
  using (
    exists (
      select 1
      from public.assets a
      where a.id = asset_id
        and (public.is_admin() or a.kind = 'apparatus')
    )
  );

create policy "vehicle_checks_insert"
  on public.vehicle_checks for insert
  to authenticated
  with check (
    checked_by = auth.uid()
    and exists (
      select 1 from public.assets a where a.id = asset_id and a.kind = 'apparatus'
    )
  );

create policy "vehicle_checks_update_own"
  on public.vehicle_checks for update
  to authenticated
  using (checked_by = auth.uid() or public.is_admin())
  with check (checked_by = auth.uid() or public.is_admin());

create policy "vehicle_checks_delete_admin"
  on public.vehicle_checks for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "vehicle_check_responses_select" on public.vehicle_check_responses;
drop policy if exists "vehicle_check_responses_insert" on public.vehicle_check_responses;
drop policy if exists "vehicle_check_responses_delete_admin" on public.vehicle_check_responses;

create policy "vehicle_check_responses_select"
  on public.vehicle_check_responses for select
  to authenticated
  using (
    exists (
      select 1
      from public.vehicle_checks vc
      join public.assets a on a.id = vc.asset_id
      where vc.id = vehicle_check_id
        and (public.is_admin() or a.kind = 'apparatus')
    )
  );

create policy "vehicle_check_responses_insert"
  on public.vehicle_check_responses for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.vehicle_checks vc
      where vc.id = vehicle_check_id
        and vc.checked_by = auth.uid()
    )
  );

create policy "vehicle_check_responses_delete_admin"
  on public.vehicle_check_responses for delete
  to authenticated
  using (public.is_admin());
