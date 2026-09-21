import { cache } from "react";
import { getAuthContext } from "@/lib/auth";
import {
  DEFAULT_SHIFT_SCHEDULE,
  parseShiftScheduleConfig,
  type ShiftScheduleConfig,
} from "@/lib/shift-schedule";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SHIFT_SETTINGS_SELECT =
  "shift_schedule_type, shift_naming_style, shift_day_anchor_date, shift_day_start_hour";

/**
 * Current department shift schedule settings (request-cached).
 * Falls back to 48/96 + colors when unauthenticated or missing row.
 */
export const getClientShiftSchedule = cache(async (): Promise<ShiftScheduleConfig> => {
  const ctx = await getAuthContext();
  if (ctx.kind !== "authenticated") return { ...DEFAULT_SHIFT_SCHEDULE };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("client_ops_settings")
    .select(SHIFT_SETTINGS_SELECT)
    .eq("client_id", ctx.clientId)
    .maybeSingle();

  if (error) {
    // Pre-migration databases: columns may not exist yet.
    if (error.code === "42703" || /shift_schedule_type|column/i.test(error.message)) {
      return { ...DEFAULT_SHIFT_SCHEDULE };
    }
    throw error;
  }

  return parseShiftScheduleConfig(data);
});
