-- Expand personnel taskbooks catalog: rank + specialty titles

alter table public.personnel_taskbooks
  drop constraint if exists personnel_taskbooks_rank_valid;

alter table public.personnel_taskbooks
  add constraint personnel_taskbooks_rank_valid check (
    rank in (
      'Firefighter',
      'Engineer',
      'Captain',
      'Battalion Chief',
      'Fire Boat Operator',
      'Drone Operator',
      'REMS'
    )
  );

comment on table public.personnel_taskbooks is
  'Rank and specialty taskbooks: member request → supervisor/BC approve (starts 1-year clock) → complete may grant swing-up for Engineer/Captain/Battalion Chief. Firefighter is issued on hire.';
