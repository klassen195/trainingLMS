-- Add quiz to module resource type enum.

alter type public.module_resource_type add value if not exists 'quiz';
