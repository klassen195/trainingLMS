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
  name?: string;
  status: AssetStatus;
  station?: string;
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
  vehicle_check_template_ids?: string[];
};

function buildAssetRow(input: AssetFormInput, createdBy?: string) {
  const base = {
    kind: input.kind,
    name: input.kind === "ppe" ? input.name?.trim() || null : null,
    status: input.status,
    station: emptyToNull(input.station),
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
  };

  if (createdBy) {
    return { ...base, created_by: createdBy };
  }
  return base;
}

async function syncAssetCheckTemplates(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  assetId: string,
  kind: AssetKind,
  templateIds: string[] | undefined
) {
  const { error: deleteError } = await supabase
    .from("asset_vehicle_check_templates")
    .delete()
    .eq("asset_id", assetId);
  throwIfDbError(deleteError);

  if (kind !== "apparatus") return;

  const ids = [...new Set((templateIds ?? []).filter(Boolean))];
  if (ids.length === 0) return;

  const { error: insertError } = await supabase.from("asset_vehicle_check_templates").insert(
    ids.map((template_id, sort_order) => ({
      asset_id: assetId,
      template_id,
      sort_order,
    }))
  );
  throwIfDbError(insertError);
}

async function closeOpenUnitAssignment(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  assetId: string,
  at: string
) {
  const { error } = await supabase
    .from("apparatus_unit_assignments")
    .update({ unassigned_at: at })
    .eq("asset_id", assetId)
    .is("unassigned_at", null);
  throwIfDbError(error);
}

async function syncUnitAssignmentHistory(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  input: {
    assetId: string;
    previousUnit: string | null;
    nextUnit: string | null;
    actorId: string;
    /** When true, clear other builds that currently hold nextUnit before history insert. */
    clearOtherHolders: boolean;
  }
) {
  const previous = emptyToNull(input.previousUnit);
  const next = emptyToNull(input.nextUnit);
  if (previous === next) return;

  const at = new Date().toISOString();

  if (input.clearOtherHolders && next) {
    const { data: holders, error: holdersError } = await supabase
      .from("assets")
      .select("id")
      .eq("kind", "apparatus")
      .eq("unit_number", next)
      .neq("id", input.assetId);
    throwIfDbError(holdersError);

    for (const holder of holders ?? []) {
      await closeOpenUnitAssignment(supabase, holder.id, at);
      const { error: clearError } = await supabase
        .from("assets")
        .update({ unit_number: null })
        .eq("id", holder.id);
      throwIfDbError(clearError);
      revalidateAssets(holder.id);
    }
  }

  if (previous) {
    await closeOpenUnitAssignment(supabase, input.assetId, at);
  }

  if (next) {
    const { error: insertError } = await supabase.from("apparatus_unit_assignments").insert({
      asset_id: input.assetId,
      unit_number: next,
      assigned_at: at,
      assigned_by: input.actorId,
    });
    throwIfDbError(insertError);
  }
}

export async function createAsset(input: AssetFormInput) {
  const profile = await requireRole(["admin"]);
  if (input.kind === "ppe" && !input.name?.trim()) throw new Error("Name is required.");
  if (input.kind === "ppe" && !input.station?.trim()) throw new Error("Station is required.");
  if (input.kind === "ppe" && !input.ppe_category) throw new Error("PPE category is required.");
  if (input.kind === "apparatus" && !input.build_number?.trim()) {
    throw new Error("Build number is required.");
  }

  const supabase = await createSupabaseServerClient();
  const row = buildAssetRow(input, profile.id);

  if (input.kind === "apparatus" && row.unit_number) {
    // Clear other holders before insert so the unique unit index allows this row.
    const { data: holders, error: holdersError } = await supabase
      .from("assets")
      .select("id")
      .eq("kind", "apparatus")
      .eq("unit_number", row.unit_number);
    throwIfDbError(holdersError);
    const at = new Date().toISOString();
    for (const holder of holders ?? []) {
      await closeOpenUnitAssignment(supabase, holder.id, at);
      const { error: clearError } = await supabase
        .from("assets")
        .update({ unit_number: null })
        .eq("id", holder.id);
      throwIfDbError(clearError);
      revalidateAssets(holder.id);
    }
  }

  const { data, error } = await supabase.from("assets").insert(row).select("id").single();

  throwIfDbError(error);
  if (input.kind === "apparatus" && row.unit_number) {
    await syncUnitAssignmentHistory(supabase, {
      assetId: data!.id,
      previousUnit: null,
      nextUnit: row.unit_number,
      actorId: profile.id,
      clearOtherHolders: false,
    });
  }
  await syncAssetCheckTemplates(
    supabase,
    data!.id,
    input.kind,
    input.vehicle_check_template_ids
  );
  revalidateAssets(data?.id);
  redirect(`/assets/${data!.id}`);
}

export async function updateAsset(id: string, input: AssetFormInput) {
  const profile = await requireRole(["admin"]);
  if (input.kind === "ppe" && !input.name?.trim()) throw new Error("Name is required.");
  if (input.kind === "ppe" && !input.station?.trim()) throw new Error("Station is required.");
  if (input.kind === "ppe" && !input.ppe_category) throw new Error("PPE category is required.");
  if (input.kind === "apparatus" && !input.build_number?.trim()) {
    throw new Error("Build number is required.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("assets")
    .select("unit_number")
    .eq("id", id)
    .maybeSingle();
  throwIfDbError(existingError);
  if (!existing) throw new Error("Asset not found.");

  const row = buildAssetRow(input);
  const previousUnit = emptyToNull(existing.unit_number);
  const nextUnit = emptyToNull(row.unit_number);

  if (input.kind === "apparatus" && nextUnit && nextUnit !== previousUnit) {
    const at = new Date().toISOString();
    const { data: holders, error: holdersError } = await supabase
      .from("assets")
      .select("id")
      .eq("kind", "apparatus")
      .eq("unit_number", nextUnit)
      .neq("id", id);
    throwIfDbError(holdersError);
    for (const holder of holders ?? []) {
      await closeOpenUnitAssignment(supabase, holder.id, at);
      const { error: clearError } = await supabase
        .from("assets")
        .update({ unit_number: null })
        .eq("id", holder.id);
      throwIfDbError(clearError);
      revalidateAssets(holder.id);
    }
  }

  const { error } = await supabase.from("assets").update(row).eq("id", id);
  throwIfDbError(error);

  if (input.kind === "apparatus") {
    await syncUnitAssignmentHistory(supabase, {
      assetId: id,
      previousUnit,
      nextUnit,
      actorId: profile.id,
      clearOtherHolders: false,
    });
  }

  await syncAssetCheckTemplates(supabase, id, input.kind, input.vehicle_check_template_ids);
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
