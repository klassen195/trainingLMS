-- Allow anyone with document_training to edit sessions and manage attendees/files.

drop policy if exists "training_sessions_update" on public.training_sessions;
create policy "training_sessions_update"
  on public.training_sessions for update
  to authenticated
  using (public.has_capability('document_training'))
  with check (public.has_capability('document_training'));

drop policy if exists "training_sessions_delete" on public.training_sessions;
create policy "training_sessions_delete"
  on public.training_sessions for delete
  to authenticated
  using (public.has_capability('document_training'));

drop policy if exists "training_session_attendees_insert" on public.training_session_attendees;
create policy "training_session_attendees_insert"
  on public.training_session_attendees for insert
  to authenticated
  with check (public.has_capability('document_training'));

drop policy if exists "training_session_attendees_delete" on public.training_session_attendees;
create policy "training_session_attendees_delete"
  on public.training_session_attendees for delete
  to authenticated
  using (public.has_capability('document_training'));

drop policy if exists "training_session_files_insert" on public.training_session_files;
create policy "training_session_files_insert"
  on public.training_session_files for insert
  to authenticated
  with check (
    public.has_capability('document_training')
    and uploaded_by = auth.uid()
  );

drop policy if exists "training_session_files_delete" on public.training_session_files;
create policy "training_session_files_delete"
  on public.training_session_files for delete
  to authenticated
  using (public.has_capability('document_training'));
