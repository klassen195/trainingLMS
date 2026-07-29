-- Add required title to maintenance requests; description stays optional (empty allowed).

alter table public.maintenance_requests
  add column if not exists title text;

update public.maintenance_requests
set title = case
  when nullif(trim(description), '') is not null then left(trim(description), 80)
  else 'Maintenance request'
end
where title is null or trim(title) = '';

alter table public.maintenance_requests
  alter column title set default '',
  alter column title set not null;

alter table public.maintenance_requests
  drop constraint if exists maintenance_requests_title_required;

alter table public.maintenance_requests
  add constraint maintenance_requests_title_required
  check (char_length(trim(title)) > 0);
