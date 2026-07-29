-- Checklist item field types: pass/fail, level gauge, short answer

do $$
begin
  if not exists (select 1 from pg_type where typname = 'vehicle_check_field_type') then
    create type public.vehicle_check_field_type as enum (
      'pass_fail',
      'level',
      'short_answer'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'vehicle_check_level') then
    create type public.vehicle_check_level as enum (
      'full',
      'three_quarters',
      'half',
      'one_quarter',
      'empty'
    );
  end if;
end $$;

alter table public.vehicle_check_template_items
  add column if not exists field_type public.vehicle_check_field_type null;

update public.vehicle_check_template_items
set field_type = 'pass_fail'
where row_kind = 'item' and field_type is null;

update public.vehicle_check_template_items
set field_type = null
where row_kind = 'section';

alter table public.vehicle_check_template_items
  drop constraint if exists vehicle_check_template_items_kind_check;

alter table public.vehicle_check_template_items
  add constraint vehicle_check_template_items_kind_check check (
    (
      row_kind = 'section'
      and check_type is null
      and field_type is null
    )
    or (
      row_kind = 'item'
      and check_type is not null
      and field_type is not null
    )
  );

alter table public.vehicle_check_responses
  add column if not exists field_type public.vehicle_check_field_type;

update public.vehicle_check_responses
set field_type = 'pass_fail'
where field_type is null;

alter table public.vehicle_check_responses
  alter column field_type set default 'pass_fail';

alter table public.vehicle_check_responses
  alter column field_type set not null;

alter table public.vehicle_check_responses
  alter column result drop not null;

alter table public.vehicle_check_responses
  add column if not exists level_value public.vehicle_check_level null;

alter table public.vehicle_check_responses
  add column if not exists text_value text not null default '';

alter table public.vehicle_check_responses
  drop constraint if exists vehicle_check_responses_answer_check;

alter table public.vehicle_check_responses
  add constraint vehicle_check_responses_answer_check check (
    (
      field_type = 'pass_fail'
      and result in ('pass', 'fail')
      and level_value is null
    )
    or (
      field_type = 'level'
      and result is null
      and level_value is not null
    )
    or (
      field_type = 'short_answer'
      and result is null
      and level_value is null
      and char_length(trim(text_value)) > 0
    )
  );
