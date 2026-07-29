-- Moved/Not moved field type and result values (enums only; constraint in follow-up)

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'vehicle_check_field_type'
      and e.enumlabel = 'moved_status'
  ) then
    alter type public.vehicle_check_field_type add value 'moved_status';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'vehicle_check_item_result'
      and e.enumlabel = 'moved'
  ) then
    alter type public.vehicle_check_item_result add value 'moved';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'vehicle_check_item_result'
      and e.enumlabel = 'not_moved'
  ) then
    alter type public.vehicle_check_item_result add value 'not_moved';
  end if;
end $$;
