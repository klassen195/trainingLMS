"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, getAuthContext } from "@/lib/auth";
import {
  isShiftNamingStyle,
  isShiftScheduleType,
  parseShiftScheduleConfig,
  type ShiftScheduleConfig,
} from "@/lib/shift-schedule";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SHIFT_SETTINGS_SELECT =
  "client_id, shift_schedule_type, shift_naming_style, shift_day_anchor_date, shift_day_start_hour";

function revalidateShiftSettings() {
  revalidatePath("/admin/shift-schedule");
  revalidatePath("/shift-plan", "layout");
  revalidatePath("/shift-exchange", "layout");
  revalidatePath("/personnel", "layout");
  revalidatePath("/", "layout");
}

export async function getDepartmentShiftScheduleSettings(): Promise<ShiftScheduleConfig> {
  await requireAdmin();
  const ctx = await getAuthContext();
  if (ctx.kind !== "authenticated") throw new Error("Not authenticated");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("client_ops_settings")
    .select(SHIFT_SETTINGS_SELECT)
    .eq("client_id", ctx.clientId)
    .maybeSingle();
  if (error) throw error;
  return parseShiftScheduleConfig(data);
}

export async function updateDepartmentShiftScheduleSettings(input: {
  scheduleType: string;
  namingStyle: string;
  anchorDate: string;
  startHour: number;
}) {
  await requireAdmin();
  const ctx = await getAuthContext();
  if (ctx.kind !== "authenticated") throw new Error("Not authenticated");

  if (!isShiftScheduleType(input.scheduleType)) {
    throw new Error("Invalid shift schedule type.");
  }
  if (!isShiftNamingStyle(input.namingStyle)) {
    throw new Error("Invalid shift naming style.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.anchorDate)) {
    throw new Error("Anchor date must be YYYY-MM-DD.");
  }
  if (!Number.isFinite(input.startHour) || input.startHour < 0 || input.startHour > 23) {
    throw new Error("Shift start hour must be between 0 and 23.");
  }

  const payload = {
    client_id: ctx.clientId,
    shift_schedule_type: input.scheduleType,
    shift_naming_style: input.namingStyle,
    shift_day_anchor_date: input.anchorDate,
    shift_day_start_hour: Math.trunc(input.startHour),
  };

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("client_ops_settings")
    .select("client_id")
    .eq("client_id", ctx.clientId)
    .maybeSingle();

  const result = existing
    ? await supabase.from("client_ops_settings").update(payload).eq("client_id", ctx.clientId)
    : await supabase.from("client_ops_settings").insert(payload);

  if (result.error) throw result.error;
  revalidateShiftSettings();
}
