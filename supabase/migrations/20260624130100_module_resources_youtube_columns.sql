-- YouTube module resource columns and validation.

alter table public.module_resources
  add column if not exists external_url text,
  alter column storage_path drop not null,
  alter column file_name drop not null;

alter table public.module_resources
  drop constraint if exists module_resources_source_check;

alter table public.module_resources
  add constraint module_resources_source_check check (
    (
      resource_type = 'youtube'
      and external_url is not null
      and storage_path is null
    )
    or (
      resource_type <> 'youtube'
      and storage_path is not null
      and file_name is not null
      and external_url is null
    )
  );
