-- Per-department fire shift schedule type, naming style, and rotation anchor.

alter type public.shift_color add value if not exists 'White';

alter table public.client_ops_settings
  add column if not exists shift_schedule_type text not null default '48_96',
  add column if not exists shift_naming_style text not null default 'colors',
  add column if not exists shift_day_anchor_date date not null default '2026-05-26',
  add column if not exists shift_day_start_hour smallint not null default 8;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'client_ops_settings_shift_schedule_type_check'
  ) then
    alter table public.client_ops_settings
      add constraint client_ops_settings_shift_schedule_type_check
      check (shift_schedule_type in ('24_48', '48_96', '24_72'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'client_ops_settings_shift_naming_style_check'
  ) then
    alter table public.client_ops_settings
      add constraint client_ops_settings_shift_naming_style_check
      check (shift_naming_style in ('colors', 'letters', 'numbers'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'client_ops_settings_shift_day_start_hour_check'
  ) then
    alter table public.client_ops_settings
      add constraint client_ops_settings_shift_day_start_hour_check
      check (shift_day_start_hour >= 0 and shift_day_start_hour <= 23);
  end if;
end $$;
