-- Expiration date on personnel qualification assignments

alter table public.personnel_qualifications
  add column if not exists expires_on date;

create index if not exists personnel_qualifications_expires_on_idx
  on public.personnel_qualifications (expires_on);
