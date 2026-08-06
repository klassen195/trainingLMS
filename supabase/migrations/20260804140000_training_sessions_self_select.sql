-- Allow members to read their own attendance for YTD hours on personnel files.
-- Admins / document_training already covered by has_capability (admins always true).

drop policy if exists "training_session_attendees_select" on public.training_session_attendees;
create policy "training_session_attendees_select"
  on public.training_session_attendees for select
  to authenticated
  using (
    public.has_capability('document_training')
    or profile_id = auth.uid()
  );

drop policy if exists "training_sessions_select" on public.training_sessions;
create policy "training_sessions_select"
  on public.training_sessions for select
  to authenticated
  using (
    public.has_capability('document_training')
    or exists (
      select 1
      from public.training_session_attendees a
      where a.session_id = training_sessions.id
        and a.profile_id = auth.uid()
    )
  );
