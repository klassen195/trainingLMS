-- Website link and checklist module resource types.

alter type public.module_resource_type add value if not exists 'link';
alter type public.module_resource_type add value if not exists 'checklist';
