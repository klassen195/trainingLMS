-- Track when a personnel invite email was sent (null = added but not invited yet).

alter table public.profiles
  add column if not exists invited_at timestamptz;

comment on column public.profiles.invited_at is
  'When the Auth invite email was last sent. Null means the member was added but has not been invited to sign in yet.';

-- Existing members were created through the old invite-on-create flow.
update public.profiles
set invited_at = created_at
where invited_at is null;
