-- Allow YouTube links as module resources (no file upload).
-- Enum value must be committed before it is used in constraints below.

alter type public.module_resource_type add value if not exists 'youtube';
