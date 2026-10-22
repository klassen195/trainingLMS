-- Loose equipment sits in a compartment, not in a named bag.
-- It is stored as one hidden bag per compartment so loadout lines,
-- placements, and complement totals keep working.

alter table public.rope_bags
  add column if not exists is_loose boolean not null default false;

drop index if exists public.rope_bags_compartment_name_uidx;
create unique index rope_bags_compartment_name_uidx
  on public.rope_bags (compartment_id, lower(trim(name)))
  where not is_loose;

create unique index if not exists rope_bags_one_loose_uidx
  on public.rope_bags (compartment_id)
  where is_loose;
