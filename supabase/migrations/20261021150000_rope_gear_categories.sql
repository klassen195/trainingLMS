create table if not exists public.rope_gear_categories (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  detail_kind text not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rope_gear_categories_name_nonempty check (length(trim(name)) > 0),
  constraint rope_gear_categories_detail_kind_check
    check (detail_kind in ('none', 'rope', 'webbing', 'carabiner'))
);

create unique index if not exists rope_gear_categories_client_name_uidx
  on public.rope_gear_categories (client_id, lower(trim(name)));

drop trigger if exists rope_gear_categories_updated_at on public.rope_gear_categories;
create trigger rope_gear_categories_updated_at
  before update on public.rope_gear_categories
  for each row execute function public.rope_set_updated_at();

drop trigger if exists set_client_id_default on public.rope_gear_categories;
create trigger set_client_id_default
  before insert on public.rope_gear_categories
  for each row execute function public.set_row_client_id();

alter table public.rope_gear_categories enable row level security;

drop policy if exists tenant_isolation on public.rope_gear_categories;
create policy tenant_isolation
  on public.rope_gear_categories
  as restrictive
  for all
  to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

drop policy if exists rope_gear_categories_select on public.rope_gear_categories;
create policy rope_gear_categories_select
  on public.rope_gear_categories
  for select
  to authenticated
  using (public.rope_can_view());

drop policy if exists rope_gear_categories_insert on public.rope_gear_categories;
create policy rope_gear_categories_insert
  on public.rope_gear_categories
  for insert
  to authenticated
  with check (public.has_capability('manage_rope_inventory'));

drop policy if exists rope_gear_categories_update on public.rope_gear_categories;
create policy rope_gear_categories_update
  on public.rope_gear_categories
  for update
  to authenticated
  using (public.has_capability('manage_rope_inventory'))
  with check (public.has_capability('manage_rope_inventory'));

drop policy if exists rope_gear_categories_delete on public.rope_gear_categories;
create policy rope_gear_categories_delete
  on public.rope_gear_categories
  for delete
  to authenticated
  using (public.has_capability('manage_rope_inventory'));

insert into public.rope_gear_categories (client_id, name, sort_order, detail_kind)
select clients.id, seed.name, seed.sort_order, seed.detail_kind
from public.clients as clients
cross join (
  values
    (0, 'Rope', 'rope'),
    (1, 'Webbing', 'webbing'),
    (2, 'Carabiners', 'carabiner'),
    (3, 'Rope grabs', 'none'),
    (4, 'Pulleys', 'none'),
    (5, 'Belay', 'none'),
    (6, 'Anchors', 'none'),
    (7, 'Rigging hardware', 'none'),
    (8, 'PPE', 'none'),
    (9, 'Rope Protection', 'none'),
    (10, 'Edge protection', 'none'),
    (11, 'High directionals', 'none'),
    (12, 'Patient packaging', 'none'),
    (13, 'Other', 'none')
) as seed(sort_order, name, detail_kind)
where not exists (
  select 1
  from public.rope_gear_categories as existing
  where existing.client_id = clients.id
    and lower(trim(existing.name)) = lower(trim(seed.name))
);

alter table public.rope_gear_types
  add column if not exists category_id uuid references public.rope_gear_categories (id) on delete restrict,
  add column if not exists color text not null default '',
  add column if not exists diameter text not null default '',
  add column if not exists length text not null default '',
  add column if not exists brand text not null default '',
  add column if not exists material text not null default '';

create index if not exists rope_gear_types_category_idx
  on public.rope_gear_types (category_id);

update public.rope_gear_types as gear
set category_id = category.id
from public.rope_gear_categories as category
where gear.category_id is null
  and category.client_id = gear.client_id
  and category.name = case
    when gear.name ~* '^Rope \(' then 'Rope'
    when gear.name ~* '^Webbing \(' or lower(trim(gear.name)) = 'daisy chain' then 'Webbing'
    when gear.name ~* '^Carabiner' or lower(trim(gear.name)) = 'rollclip z' then 'Carabiners'
    when gear.name ~* '^Prusik \(' or lower(trim(gear.name)) = 'tibloc' then 'Rope grabs'
    when gear.name ~* '^Pulley \(' then 'Pulleys'
    when lower(trim(gear.name)) = 'clutch' then 'Belay'
    when lower(trim(gear.name)) = 'squid' then 'Rigging hardware'
    when lower(trim(gear.name)) = 'gloves' then 'PPE'
    else 'Other'
  end;

drop index if exists public.rope_gear_types_client_name_uidx;

update public.rope_gear_types
set
  length = (regexp_match(name, '^Rope \(([0-9]+)\)[[:space:]]*$', 'i'))[1] || ' ft',
  name = 'Rope'
where name ~* '^Rope \([0-9]+\)[[:space:]]*$';

update public.rope_gear_types
set
  color = (regexp_match(name, '^Webbing \((.+)\)[[:space:]]*$', 'i'))[1],
  name = 'Webbing'
where name ~* '^Webbing \(.+\)[[:space:]]*$';

update public.rope_gear_types
set
  brand = 'CMC',
  material = 'Aluminum',
  notes = case when length(trim(notes)) = 0 then 'G' else notes end,
  name = 'Carabiner'
where name ~* '^Carabiner \(CMC Aluminum - G\)[[:space:]]*$';

update public.rope_gear_types as gear
set category_id = category.id
from public.rope_gear_categories as category
where gear.category_id is null
  and category.client_id = gear.client_id
  and category.name = 'Other';

alter table public.rope_gear_types
  alter column category_id set not null;

create unique index if not exists rope_gear_types_client_identity_uidx
  on public.rope_gear_types (
    client_id,
    lower(trim(name)),
    lower(trim(color)),
    lower(trim(diameter)),
    lower(trim(length)),
    lower(trim(brand)),
    lower(trim(material))
  );
