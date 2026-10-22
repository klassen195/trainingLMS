-- Remember the order of gear lines inside a bag. Existing lines keep their
-- current alphabetical order.

alter table public.rope_bag_lines
  add column if not exists sort_order integer not null default 0;

with ranked as (
  select
    lines.id,
    row_number() over (
      partition by lines.bag_id
      order by lower(coalesce(gear.name, '')), lines.created_at, lines.id
    )::integer as rn
  from public.rope_bag_lines as lines
  left join public.rope_gear_types as gear on gear.id = lines.gear_type_id
)
update public.rope_bag_lines as lines
set sort_order = ranked.rn
from ranked
where lines.id = ranked.id;
