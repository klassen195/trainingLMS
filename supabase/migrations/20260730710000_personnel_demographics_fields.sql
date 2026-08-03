-- Demographics fields for personnel profiles

alter table public.profiles
  add column if not exists home_address text,
  add column if not exists emergency_contacts text,
  add column if not exists hr_info text;
