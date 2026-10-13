-- Red-first platoon order is a rotate of the prior Green→Red→Blue cycle.
-- Advance each department's anchor by one tour so calendar day colors stay the same.

alter table public.client_ops_settings
  alter column shift_day_anchor_date set default '2026-05-28';

update public.client_ops_settings
set shift_day_anchor_date = shift_day_anchor_date + case shift_schedule_type
  when '48_96' then 2
  else 1
end;
