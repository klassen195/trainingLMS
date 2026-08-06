-- Add Critical Care Transport taskbook

alter table public.personnel_taskbooks
  drop constraint if exists personnel_taskbooks_rank_valid;

alter table public.personnel_taskbooks
  add constraint personnel_taskbooks_rank_valid check (
    rank in (
      'Firefighter',
      'Engineer',
      'Captain',
      'Battalion Chief',
      'Deputy Fire Marshal',
      'MSO',
      'Critical Care Transport',
      'Fire Boat Operator',
      'Rescue Boat Operator',
      'Drone Operator',
      'REMS'
    )
  );

alter table public.personnel_taskbook_prerequisite_checks
  drop constraint if exists personnel_taskbook_prereq_rank_valid;

alter table public.personnel_taskbook_prerequisite_checks
  add constraint personnel_taskbook_prereq_rank_valid check (
    rank in (
      'Firefighter',
      'Engineer',
      'Captain',
      'Battalion Chief',
      'Deputy Fire Marshal',
      'MSO',
      'Critical Care Transport',
      'Fire Boat Operator',
      'Rescue Boat Operator',
      'Drone Operator',
      'REMS'
    )
  );
