-- Add Tender to apparatus_type enum (idempotent).
do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'apparatus_type'
      and e.enumlabel = 'tender'
  ) then
    alter type public.apparatus_type add value 'tender';
  end if;
end $$;
