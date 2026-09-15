"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { assertCapability } from "@/lib/capability-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingShiftPlanTable, supabaseErrorMessage } from "@/lib/supabase/errors";
import { listLocations } from "@/lib/locations";
import {
  addCalendarDaysIso,
  isIsoDateString,
  normalizeTimeInput,
  shiftDayStartForCalendarDate,
} from "@/lib/dates";
import { shiftColorForShiftDay } from "@/lib/shift-rotation";
import type { ShiftPlanScope } from "@/lib/shift-plan-types";

function throwIfDbError(error: PostgrestError | null) {
  if (!error) return;
  if (isMissingShiftPlanTable(error)) {
    throw new Error(
      "Database not set up yet. Run supabase/migrations/20260831232552_shift_plan.sql in the Supabase SQL editor."
    );
  }
  throw new Error(supabaseErrorMessage(error));
}

function revalidateShiftPlan(shiftDate: string) {
  revalidatePath("/shift-plan");
  revalidatePath(`/shift-plan/${shiftDate}`);
}

function parseShiftDate(value: string) {
  if (!isIsoDateString(value)) throw new Error("Invalid shift date.");
  return shiftDayStartForCalendarDate(value);
}

function parseScope(value: string): ShiftPlanScope {
  if (value === "battalion" || value === "station") return value;
  throw new Error("Choose battalion or station.");
}

function parseOptionalDate(value: string | null | undefined, shiftDate: string) {
  const trimmed = value?.trim() || "";
  if (!trimmed) return null;
  if (!isIsoDateString(trimmed)) throw new Error("Invalid item date.");
  const dayTwo = addCalendarDaysIso(shiftDate, 1);
  if (trimmed !== shiftDate && trimmed !== dayTwo) {
    throw new Error("Item date must fall on this shift.");
  }
  return trimmed;
}

export type ShiftPlanItemInput = {
  shiftDate: string;
  title: string;
  notes: string;
  scope: string;
  locationId: string | null;
  itemDate: string | null;
  startTime: string | null;
  endTime: string | null;
};

async function resolvedItemFields(input: ShiftPlanItemInput) {
  const profile = await assertCapability("access_shift_plan");
  const shiftDate = parseShiftDate(input.shiftDate);
  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");
  const scope = parseScope(input.scope);
  const itemDate = parseOptionalDate(input.itemDate, shiftDate);
  const startTime = normalizeTimeInput(input.startTime);
  const endTime = normalizeTimeInput(input.endTime);
  if (endTime && !startTime) throw new Error("Set a start time before an end time.");
  if (startTime && endTime && endTime <= startTime) {
    throw new Error("End time must be after start time.");
  }

  let locationId: string | null = null;
  if (scope === "station") {
    const id = input.locationId?.trim() || "";
    if (!id) throw new Error("Choose a station.");
    const supabase = await createSupabaseServerClient();
    const { rows, error } = await listLocations(supabase, { activeOnly: true, shiftPlanOnly: true });
    if (error) throw new Error(error.message);
    if (!rows.some((location) => location.id === id)) {
      throw new Error("Choose a station that is included on the Shift Plan.");
    }
    locationId = id;
  }

  return {
    profile,
    row: {
      client_id: profile.client_id,
      created_by: profile.id,
      shift_date: shiftDate,
      shift_color: shiftColorForShiftDay(shiftDate),
      scope,
      location_id: locationId,
      title,
      notes: input.notes.trim(),
      item_date: itemDate,
      start_time: startTime,
      end_time: endTime,
    },
  };
}

export async function createShiftPlanItem(input: ShiftPlanItemInput) {
  const { row } = await resolvedItemFields(input);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("shift_plan_items").insert(row);
  throwIfDbError(error);
  revalidateShiftPlan(row.shift_date);
}

export async function updateShiftPlanItem(input: ShiftPlanItemInput & { id: string }) {
  const { row } = await resolvedItemFields(input);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("shift_plan_items")
    .update({
      shift_date: row.shift_date,
      shift_color: row.shift_color,
      scope: row.scope,
      location_id: row.location_id,
      title: row.title,
      notes: row.notes,
      item_date: row.item_date,
      start_time: row.start_time,
      end_time: row.end_time,
    })
    .eq("id", input.id);
  throwIfDbError(error);
  revalidateShiftPlan(row.shift_date);
}

export async function deleteShiftPlanItem(input: { id: string; shiftDate: string }) {
  await assertCapability("access_shift_plan");
  const shiftDate = parseShiftDate(input.shiftDate);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("shift_plan_items").delete().eq("id", input.id);
  throwIfDbError(error);
  revalidateShiftPlan(shiftDate);
}

export async function setShiftPlanItemCompleted(input: {
  id: string;
  shiftDate: string;
  completed: boolean;
}) {
  await assertCapability("access_shift_plan");
  const shiftDate = parseShiftDate(input.shiftDate);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("shift_plan_items")
    .update({
      completed: input.completed,
      completed_at: input.completed ? new Date().toISOString() : null,
    })
    .eq("id", input.id);
  throwIfDbError(error);
  revalidateShiftPlan(shiftDate);
}
