"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingAssetsTable, supabaseErrorMessage } from "@/lib/supabase/errors";
import type {
  ApparatusType,
  AssetKind,
  AssetStatus,
  InspectionResult,
  PpeCategory,
} from "@/lib/assets-types";

function throwIfDbError(error: PostgrestError | null) {
  if (!error) return;
  if (isMissingAssetsTable(error)) {
    throw new Error(
      "Database not set up yet. Run supabase/migrations/20260720130000_assets_inventory.sql in the Supabase SQL editor."
    );
  }
  throw new Error(supabaseErrorMessage(error));
}

function revalidateAssets(assetId?: string) {
  revalidatePath("/assets", "layout");
  if (assetId) {
    revalidatePath(`/assets/${assetId}`);
    revalidatePath(`/assets/${assetId}/edit`);
  }
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export type AssetFormInput = {
  kind: AssetKind;
  name: string;
  status: AssetStatus;
  station: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  notes?: string;
  assigned_to?: string | null;
  ppe_category?: PpeCategory | null;
  size?: string;
  manufactured_on?: string | null;
  expires_on?: string | null;
  unit_number?: string;
  apparatus_type?: ApparatusType | null;
  year?: number | null;
  build_number?: string;
  vehicle_check_template_id?: string | null;
};

function buildAssetRow(input: AssetFormInput, createdBy?: string) {
  const base = {
    kind: input.kind,
    name: input.name.trim(),
    status: input.status,
    station: input.station.trim(),
    manufacturer: emptyToNull(input.manufacturer),
    model: emptyToNull(input.model),
    serial_number: emptyToNull(input.serial_number),
    notes: input.notes?.trim() ?? "",
    assigned_to: input.kind === "ppe" ? emptyToNull(input.assigned_to ?? undefined) : null,
    ppe_category: input.kind === "ppe" ? input.ppe_category ?? null : null,
    size: input.kind === "ppe" ? emptyToNull(input.size) : null,
    manufactured_on: input.kind === "ppe" ? emptyToNull(input.manufactured_on ?? undefined) : null,
    expires_on: input.kind === "ppe" ? emptyToNull(input.expires_on ?? undefined) : null,
    unit_number: input.kind === "apparatus" ? emptyToNull(input.unit_number) : null,
    apparatus_type: input.kind === "apparatus" ? input.apparatus_type ?? null : null,
    year: input.kind === "apparatus" ? input.year ?? null : null,
    build_number: input.kind === "apparatus" ? emptyToNull(input.build_number) : null,
    vehicle_check_template_id:
      input.kind === "apparatus"
        ? emptyToNull(input.vehicle_check_template_id ?? undefined)
        : null,
  };

  if (createdBy) {
    return { ...base, created_by: createdBy };
  }
  return base;
}

export async function createAsset(input: AssetFormInput) {
  const profile = await requireRole(["admin"]);
  if (!input.name.trim()) throw new Error("Name is required.");
  if (!input.station.trim()) throw new Error("Station is required.");
  if (input.kind === "ppe" && !input.ppe_category) throw new Error("PPE category is required.");
  if (input.kind === "apparatus" && !input.apparatus_type) {
    throw new Error("Apparatus type is required.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assets")
    .insert(buildAssetRow(input, profile.id))
    .select("id")
    .single();

  throwIfDbError(error);
  revalidateAssets(data?.id);
  redirect(`/assets/${data!.id}`);
}

export async function updateAsset(id: string, input: AssetFormInput) {
  await requireRole(["admin"]);
  if (!input.name.trim()) throw new Error("Name is required.");
  if (!input.station.trim()) throw new Error("Station is required.");
  if (input.kind === "ppe" && !input.ppe_category) throw new Error("PPE category is required.");
  if (input.kind === "apparatus" && !input.apparatus_type) {
    throw new Error("Apparatus type is required.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("assets").update(buildAssetRow(input)).eq("id", id);

  throwIfDbError(error);
  revalidateAssets(id);
  redirect(`/assets/${id}`);
}

export async function deleteAsset(id: string) {
  await requireRole(["admin"]);
  const supabase = await createSupabaseServerClient();
  const { data: asset, error: fetchError } = await supabase
    .from("assets")
    .select("kind")
    .eq("id", id)
    .maybeSingle();

  throwIfDbError(fetchError);

  const { error } = await supabase.from("assets").delete().eq("id", id);
  throwIfDbError(error);
  revalidateAssets(id);

  if (asset?.kind === "ppe") redirect("/assets/ppe");
  redirect("/assets/apparatus");
}

export async function createAssetInspection(input: {
  assetId: string;
  result: InspectionResult;
  notes?: string;
  next_due_on?: string | null;
  inspected_at?: string | null;
}) {
  const profile = await requireRole(["admin"]);
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("asset_inspections").insert({
    asset_id: input.assetId,
    result: input.result,
    notes: input.notes?.trim() ?? "",
    next_due_on: emptyToNull(input.next_due_on ?? undefined),
    inspected_at: emptyToNull(input.inspected_at ?? undefined) ?? new Date().toISOString(),
    inspected_by: profile.id,
  });

  throwIfDbError(error);
  revalidateAssets(input.assetId);
}
