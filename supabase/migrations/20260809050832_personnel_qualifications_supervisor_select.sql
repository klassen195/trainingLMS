-- Allow assigned supervisors and shift Battalion Chiefs to view personnel qualifications

drop policy if exists "personnel_qualifications_select" on public.personnel_qualifications;
create policy "personnel_qualifications_select"
  on public.personnel_qualifications for select
  to authenticated
  using (
    profile_id = auth.uid()
    or public.is_admin()
    or public.has_capability('document_training')
    or exists (
      select 1 from public.profiles p
      where p.id = personnel_qualifications.profile_id
        and p.supervisor_id = auth.uid()
    )
    or public.is_battalion_chief_of(personnel_qualifications.profile_id)
  );
