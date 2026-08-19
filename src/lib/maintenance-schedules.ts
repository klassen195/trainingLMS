import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { isMissingMaintenanceSchedulesTable } from "@/lib/supabase/errors";
import { isoDateLocal } from "@/lib/dates";

export type AssetMaintenanceSchedule = {
  id: string;
  created_at: string;
  updated_at: string;
  asset_id: string;
  title: string;
  interval_days: number;
  last_completed_on: string | null;
  next_due_on: string;
  notes: string;
  created_by: string | null;
};

export const ASSET_MAINTENANCE_SCHEDULE_SELECT =
  "id, created_at, updated_at, asset_id, title, interval_days, last_completed_on, next_due_on, notes, created_by";

export function addCalendarDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return isoDateLocal(date);
}

export function isScheduleOverdue(nextDueOn: string, today = isoDateLocal(new Date())) {
  return nextDueOn < today;
}

export function isScheduleDueSoon(
  nextDueOn: string,
  days = 7,
  today = isoDateLocal(new Date())
) {
  if (isScheduleOverdue(nextDueOn, today)) return false;
  return nextDueOn <= addCalendarDays(today, days);
}

export async function fetchMaintenanceSchedulesByAssetIds(
  supabase: SupabaseClient,
  assetIds: string[]
): Promise<{
  byAssetId: Record<string, AssetMaintenanceSchedule[]>;
  error: PostgrestError | null;
}> {
  if (assetIds.length === 0) return { byAssetId: {}, error: null };

  const { data, error } = await supabase
    .from("asset_maintenance_schedules")
    .select(ASSET_MAINTENANCE_SCHEDULE_SELECT)
    .in("asset_id", assetIds)
    .order("next_due_on", { ascending: true });

  if (isMissingMaintenanceSchedulesTable(error)) return { byAssetId: {}, error: null };
  if (error) return { byAssetId: {}, error };

  const byAssetId: Record<string, AssetMaintenanceSchedule[]> = {};
  for (const schedule of (data ?? []) as AssetMaintenanceSchedule[]) {
    const list = byAssetId[schedule.asset_id] ?? [];
    list.push(schedule);
    byAssetId[schedule.asset_id] = list;
  }

  return { byAssetId, error: null };
}

export function nextDueSchedule(schedules: AssetMaintenanceSchedule[] | undefined) {
  if (!schedules || schedules.length === 0) return null;
  return [...schedules].sort((a, b) => a.next_due_on.localeCompare(b.next_due_on))[0] ?? null;
}
