-- GoTrue's admin createUser writes custom app_metadata in a follow-up UPDATE,
-- so AFTER INSERT triggers never see app_metadata.client_id. user_metadata is
-- present on the INSERT row, so accept client_id from either column.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_first text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), '');
  meta_last text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), '');
  meta_display text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  composed text;
  client_uuid uuid := nullif(
    btrim(coalesce(
      new.raw_app_meta_data ->> 'client_id',
      new.raw_user_meta_data ->> 'client_id',
      ''
    )),
    ''
  )::uuid;
  level_id uuid;
begin
  if meta_first is not null or meta_last is not null then
    composed := nullif(btrim(concat_ws(' ', meta_first, meta_last)), '');
  else
    composed := coalesce(meta_display, split_part(new.email, '@', 1));
  end if;

  if client_uuid is null then
    raise exception 'New users must be invited with a client_id in app_metadata or user_metadata';
  end if;

  level_id := public.default_permission_level_id(client_uuid);
  if level_id is null then
    raise exception 'Client % has no permission levels', client_uuid;
  end if;

  insert into public.profiles (
    id, display_name, first_name, last_name, email, client_id
  )
  values (new.id, composed, meta_first, meta_last, new.email, client_uuid);

  insert into public.profile_permission_levels (profile_id, permission_level_id, client_id)
  values (new.id, level_id, client_uuid);

  return new;
end;
$$;
