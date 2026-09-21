-- Optional qualification granted when a personnel taskbook is completed.
-- Mirrors training_sessions.qualification_id → personnel_qualifications grants.

alter table public.taskbook_types
  add column if not exists qualification_id uuid
    references public.qualifications (id) on delete set null;

create index if not exists taskbook_types_qualification_id_idx
  on public.taskbook_types (qualification_id);

comment on column public.taskbook_types.qualification_id is
  'When set, completing a personnel instance of this taskbook awards the qualification.';

alter table public.personnel_qualifications
  add column if not exists source_taskbook_id uuid
    references public.personnel_taskbooks (id) on delete set null;

create index if not exists personnel_qualifications_source_taskbook_id_idx
  on public.personnel_qualifications (source_taskbook_id);

comment on column public.personnel_qualifications.source_taskbook_id is
  'Personnel taskbook that granted this qualification, when awarded via taskbook completion.';
