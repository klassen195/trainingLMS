"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { assertFleetShopAccess } from "@/lib/capability-access";
import {
  addCalendarDays,
  type AssetMaintenanceSchedule,
} from "@/lib/maintenance-schedules";
import {
  type MaintenanceRequestType,
  type MaintenanceServiceStatus,
  type MaintenanceShopStatus,
} from "@/lib/maintenance-types";
import { isoDateLocal } from "@/lib/dates";
import {
  isMissingMaintenanceRequestsTable,
  isMissingMaintenanceSchedulesTable,
  supabaseErrorMessage,
} from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveMaintenanceRequest } from "@/app/assets/maintenance-actions";

const SHOP_STATUSES = new Set<MaintenanceShopStatus>([
  "new",
  "assigned",
  "in_progress",
  "on_hold",
]);

function throwIfDbError(error: PostgrestError | null) {
  if (!error) return;
  if (isMissingMaintenanceRequestsTable(error) || isMissingMaintenanceSchedulesTable(error)) {
    throw new Error(
      "Database not set up yet. Run supabase/migrations/20260815120000_fleet_mechanics_module.sql in the Supabase SQL editor."
    );
  }
  throw new Error(supabaseErrorMessage(error));
}

function revalidateFleet(assetId?: string) {
  revalidatePath("/fleet");
  revalidatePath("/admin/maintenance");
  revalidatePath("/assets", "layout");
  if (assetId) {
    revalidatePath(`/assets/${assetId}`);
  }
}

async function requireApparatus(assetId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: asset, error } = await supabase
    .from("assets")
    .select("id, kind")
    .eq("id", assetId)
    .maybeSingle();
  throwIfDbError(error);
  if (!asset) throw new Error("Apparatus not found.");
  if (asset.kind !== "apparatus") {
    throw new Error("Fleet work is limited to apparatus.");
  }
  return supabase;
}

export async function createFleetWorkOrder(input: {
  assetId: string;
  title: string;
  requestType: MaintenanceRequestType;
  serviceStatus: MaintenanceServiceStatus;
  description?: string;
  assignedTo?: string | null;
}) {
  const profile = await assertFleetShopAccess();
  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");

  const supabase = await requireApparatus(input.assetId);
  const assignedTo = input.assignedTo?.trim() || null;
  const shopStatus: MaintenanceShopStatus = assignedTo ? "assigned" : "new";

  const { data, error } = await supabase
    .from("maintenance_requests")
    .insert({
      asset_id: input.assetId,
      requested_by: profile.id,
      service_status: input.serviceStatus,
      request_type: input.requestType,
      title,
      description: input.description?.trim() ?? "",
      assigned_to: assignedTo,
      shop_status: shopStatus,
    })
    .select("id")
    .single();
  throwIfDbError(error);
  if (!data) throw new Error("Failed to create work order.");

  if (input.serviceStatus === "out_of_service") {
    const { error: oosError } = await supabase.rpc("maintenance_request_apply_out_of_service", {
      p_request_id: data.id,
    });
    throwIfDbError(oosError);
  }

  revalidateFleet(input.assetId);
}

export async function updateFleetWorkOrder(input: {
  requestId: string;
  assignedTo?: string | null;
  shopStatus?: MaintenanceShopStatus;
  shopNotes?: string;
}) {
  await assertFleetShopAccess();
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: fetchError } = await supabase
    .from("maintenance_requests")
    .select("id, asset_id, status, assigned_to, shop_status")
    .eq("id", input.requestId)
    .maybeSingle();
  throwIfDbError(fetchError);
  if (!existing) throw new Error("Work order not found.");
  if (existing.status !== "open") throw new Error("Work order is not open.");

  const patch: {
    assigned_to?: string | null;
    shop_status?: MaintenanceShopStatus;
    shop_notes?: string;
  } = {};

  if ("assignedTo" in input) {
    const assignedTo = input.assignedTo?.trim() || null;
    patch.assigned_to = assignedTo;
    if (input.shopStatus == null) {
      if (assignedTo && existing.shop_status === "new") {
        patch.shop_status = "assigned";
      } else if (!assignedTo && existing.shop_status === "assigned") {
        patch.shop_status = "new";
      }
    }
  }

  if (input.shopStatus) {
    if (!SHOP_STATUSES.has(input.shopStatus)) {
      throw new Error("Invalid shop status.");
    }
    patch.shop_status = input.shopStatus;
  }

  if (input.shopNotes != null) {
    patch.shop_notes = input.shopNotes;
  }

  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase
    .from("maintenance_requests")
    .update(patch)
    .eq("id", input.requestId)
    .eq("status", "open");
  throwIfDbError(error);
  revalidateFleet(existing.asset_id);
}

export async function resolveFleetWorkOrder(input: {
  requestId: string;
  resolvedNote?: string;
  returnToService?: boolean;
}) {
  await resolveMaintenanceRequest({
    requestId: input.requestId,
    resolvedNote: input.resolvedNote,
    returnToService: input.returnToService,
  });
}

export async function createMaintenanceSchedule(input: {
  assetId: string;
  title: string;
  intervalDays: number;
  nextDueOn?: string;
  notes?: string;
}) {
  const profile = await assertFleetShopAccess();
  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");
  const intervalDays = Number(input.intervalDays);
  if (!Number.isInteger(intervalDays) || intervalDays < 1) {
    throw new Error("Interval must be at least 1 day.");
  }

  const supabase = await requireApparatus(input.assetId);
  const today = isoDateLocal(new Date());
  const nextDueOn = input.nextDueOn?.trim() || addCalendarDays(today, intervalDays);

  const { error } = await supabase.from("asset_maintenance_schedules").insert({
    asset_id: input.assetId,
    title,
    interval_days: intervalDays,
    next_due_on: nextDueOn,
    notes: input.notes?.trim() ?? "",
    created_by: profile.id,
  });
  throwIfDbError(error);
  revalidateFleet(input.assetId);
}

export async function updateMaintenanceSchedule(input: {
  scheduleId: string;
  title?: string;
  intervalDays?: number;
  nextDueOn?: string;
  notes?: string;
}) {
  await assertFleetShopAccess();
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: fetchError } = await supabase
    .from("asset_maintenance_schedules")
    .select("id, asset_id")
    .eq("id", input.scheduleId)
    .maybeSingle();
  throwIfDbError(fetchError);
  if (!existing) throw new Error("Schedule not found.");

  const patch: Partial<
    Pick<AssetMaintenanceSchedule, "title" | "interval_days" | "next_due_on" | "notes">
  > = {};

  if (input.title != null) {
    const title = input.title.trim();
    if (!title) throw new Error("Title is required.");
    patch.title = title;
  }
  if (input.intervalDays != null) {
    const intervalDays = Number(input.intervalDays);
    if (!Number.isInteger(intervalDays) || intervalDays < 1) {
      throw new Error("Interval must be at least 1 day.");
    }
    patch.interval_days = intervalDays;
  }
  if (input.nextDueOn != null) {
    const nextDueOn = input.nextDueOn.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDueOn)) {
      throw new Error("Next due date is required.");
    }
    patch.next_due_on = nextDueOn;
  }
  if (input.notes != null) {
    patch.notes = input.notes;
  }

  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase
    .from("asset_maintenance_schedules")
    .update(patch)
    .eq("id", input.scheduleId);
  throwIfDbError(error);
  revalidateFleet(existing.asset_id);
}

export async function completeMaintenanceSchedule(input: { scheduleId: string }) {
  await assertFleetShopAccess();
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: fetchError } = await supabase
    .from("asset_maintenance_schedules")
    .select("id, asset_id, interval_days")
    .eq("id", input.scheduleId)
    .maybeSingle();
  throwIfDbError(fetchError);
  if (!existing) throw new Error("Schedule not found.");

  const today = isoDateLocal(new Date());
  const { error } = await supabase
    .from("asset_maintenance_schedules")
    .update({
      last_completed_on: today,
      next_due_on: addCalendarDays(today, existing.interval_days),
    })
    .eq("id", input.scheduleId);
  throwIfDbError(error);
  revalidateFleet(existing.asset_id);
}

export async function deleteMaintenanceSchedule(input: { scheduleId: string }) {
  await assertFleetShopAccess();
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: fetchError } = await supabase
    .from("asset_maintenance_schedules")
    .select("id, asset_id")
    .eq("id", input.scheduleId)
    .maybeSingle();
  throwIfDbError(fetchError);
  if (!existing) throw new Error("Schedule not found.");

  const { error } = await supabase
    .from("asset_maintenance_schedules")
    .delete()
    .eq("id", input.scheduleId);
  throwIfDbError(error);
  revalidateFleet(existing.asset_id);
}
