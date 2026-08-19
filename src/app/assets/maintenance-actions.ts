"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { requireUserProfile } from "@/lib/auth";
import { assertFleetShopAccess } from "@/lib/capability-access";
import {
  buildMaintenancePhotoStoragePath,
  type MaintenanceRequestType,
  type MaintenanceServiceStatus,
} from "@/lib/maintenance-types";
import {
  isMissingMaintenanceRequestsTable,
  supabaseErrorMessage,
} from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function throwIfDbError(error: PostgrestError | null) {
  if (!error) return;
  if (isMissingMaintenanceRequestsTable(error)) {
    throw new Error(
      "Database not set up yet. Run supabase/migrations/20260729310000_maintenance_requests.sql in the Supabase SQL editor."
    );
  }
  throw new Error(supabaseErrorMessage(error));
}

function revalidateMaintenance(assetId?: string) {
  revalidatePath("/assets", "layout");
  revalidatePath("/admin/maintenance");
  revalidatePath("/fleet");
  if (assetId) {
    revalidatePath(`/assets/${assetId}`);
    revalidatePath(`/assets/${assetId}/maintenance/new`);
  }
}

export async function createMaintenanceRequest(input: {
  assetId: string;
  serviceStatus: MaintenanceServiceStatus;
  requestType: MaintenanceRequestType;
  title: string;
  description?: string;
  vehicleCheckId?: string | null;
}) {
  const profile = await requireUserProfile();
  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");
  const description = input.description?.trim() ?? "";

  const supabase = await createSupabaseServerClient();

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, kind")
    .eq("id", input.assetId)
    .maybeSingle();
  throwIfDbError(assetError);
  if (!asset) throw new Error("Apparatus not found.");
  if (asset.kind !== "apparatus") {
    throw new Error("Maintenance requests can only be created for apparatus.");
  }

  if (input.vehicleCheckId) {
    const { data: check, error: checkError } = await supabase
      .from("vehicle_checks")
      .select("id, asset_id")
      .eq("id", input.vehicleCheckId)
      .maybeSingle();
    throwIfDbError(checkError);
    if (!check || check.asset_id !== input.assetId) {
      throw new Error("Linked vehicle check was not found for this apparatus.");
    }
  }

  const { data, error } = await supabase
    .from("maintenance_requests")
    .insert({
      asset_id: input.assetId,
      requested_by: profile.id,
      service_status: input.serviceStatus,
      request_type: input.requestType,
      title,
      description,
      vehicle_check_id: input.vehicleCheckId ?? null,
    })
    .select("id")
    .single();

  throwIfDbError(error);
  if (!data) throw new Error("Failed to create maintenance request.");

  revalidateMaintenance(input.assetId);
  return { requestId: data.id as string };
}

export async function finalizeMaintenanceRequest(input: {
  requestId: string;
  assetId: string;
}) {
  await requireUserProfile();
  const supabase = await createSupabaseServerClient();

  const { data: request, error: fetchError } = await supabase
    .from("maintenance_requests")
    .select("id, asset_id, status, service_status")
    .eq("id", input.requestId)
    .maybeSingle();
  throwIfDbError(fetchError);
  if (!request) throw new Error("Maintenance request not found.");
  if (request.asset_id !== input.assetId) {
    throw new Error("Maintenance request does not match this apparatus.");
  }
  if (request.status !== "open") {
    throw new Error("Maintenance request is not open.");
  }

  if (request.service_status === "out_of_service") {
    const { error } = await supabase.rpc("maintenance_request_apply_out_of_service", {
      p_request_id: input.requestId,
    });
    throwIfDbError(error);
  }

  revalidateMaintenance(input.assetId);
}

export async function prepareMaintenancePhotoUpload(input: {
  requestId: string;
  assetId: string;
  fileName: string;
}) {
  await requireUserProfile();
  const fileName = input.fileName.trim();
  if (!fileName) throw new Error("File name is required.");

  const supabase = await createSupabaseServerClient();

  const { data: request, error: fetchError } = await supabase
    .from("maintenance_requests")
    .select("id, asset_id, status, requested_by")
    .eq("id", input.requestId)
    .maybeSingle();
  throwIfDbError(fetchError);
  if (!request) throw new Error("Maintenance request not found.");
  if (request.asset_id !== input.assetId) {
    throw new Error("Maintenance request does not match this apparatus.");
  }
  if (request.status !== "open") {
    throw new Error("Photos can only be added to open requests.");
  }

  const storagePath = buildMaintenancePhotoStoragePath(
    input.assetId,
    input.requestId,
    fileName
  );

  const { error } = await supabase.rpc("maintenance_request_set_photo", {
    p_request_id: input.requestId,
    p_storage_path: storagePath,
    p_file_name: fileName,
  });
  throwIfDbError(error);

  revalidateMaintenance(input.assetId);
  return { storagePath };
}

export async function deleteMaintenanceRequest(input: {
  requestId: string;
  assetId: string;
  storagePath?: string | null;
}) {
  await requireUserProfile();
  const supabase = await createSupabaseServerClient();

  if (input.storagePath) {
    await supabase.storage.from("maintenance-photos").remove([input.storagePath]);
  }

  const { error } = await supabase
    .from("maintenance_requests")
    .delete()
    .eq("id", input.requestId)
    .eq("asset_id", input.assetId)
    .eq("status", "open");

  throwIfDbError(error);
  revalidateMaintenance(input.assetId);
}

export async function resolveMaintenanceRequest(input: {
  requestId: string;
  resolvedNote?: string;
  returnToService?: boolean;
}) {
  await assertFleetShopAccess();
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: fetchError } = await supabase
    .from("maintenance_requests")
    .select("id, asset_id, status")
    .eq("id", input.requestId)
    .maybeSingle();
  throwIfDbError(fetchError);
  if (!existing) throw new Error("Maintenance request not found.");
  if (existing.status === "resolved") return;

  const { error } = await supabase
    .from("maintenance_requests")
    .update({
      status: "resolved",
      resolved_note: input.resolvedNote?.trim() || null,
    })
    .eq("id", input.requestId)
    .eq("status", "open");

  throwIfDbError(error);

  if (input.returnToService) {
    const { error: returnError } = await supabase.rpc(
      "maintenance_request_return_in_service",
      { p_request_id: input.requestId }
    );
    throwIfDbError(returnError);
  }

  revalidateMaintenance(existing.asset_id);
}
