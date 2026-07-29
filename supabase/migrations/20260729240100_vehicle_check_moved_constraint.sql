-- Allow moved_status responses (Moved / Not moved / N/A)

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
      field_type = 'moved_status'
      and result in ('moved', 'not_moved', 'not_applicable')
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
