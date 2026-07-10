-- Move programs from a single category column to many-to-many tags.

create table public.program_tags (
  program_id uuid not null references public.programs (id) on delete cascade,
  tag public.program_category not null,
  primary key (program_id, tag)
);

insert into public.program_tags (program_id, tag)
select id, category
from public.programs;

alter table public.programs drop column category;

alter table public.program_tags enable row level security;

create policy "program_tags_select_if_program_visible"
  on public.program_tags for select
  to authenticated
  using (
    exists (
      select 1
      from public.programs p
      where p.id = program_tags.program_id
        and (
          p.status = 'published'
          or p.created_by = auth.uid()
          or public.is_admin()
        )
    )
  );

create policy "program_tags_insert_owner_or_admin"
  on public.program_tags for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.programs p
      where p.id = program_tags.program_id
        and (p.created_by = auth.uid() or public.is_admin())
    )
  );

create policy "program_tags_update_owner_or_admin"
  on public.program_tags for update
  to authenticated
  using (
    exists (
      select 1
      from public.programs p
      where p.id = program_tags.program_id
        and (p.created_by = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1
      from public.programs p
      where p.id = program_tags.program_id
        and (p.created_by = auth.uid() or public.is_admin())
    )
  );

create policy "program_tags_delete_owner_or_admin"
  on public.program_tags for delete
  to authenticated
  using (
    exists (
      select 1
      from public.programs p
      where p.id = program_tags.program_id
        and (p.created_by = auth.uid() or public.is_admin())
    )
  );
