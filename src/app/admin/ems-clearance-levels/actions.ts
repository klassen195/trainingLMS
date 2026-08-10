"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isMissingEmsClearanceLevelsTable,
  supabaseErrorMessage,
} from "@/lib/supabase/errors";
import {
  EMS_CLEARANCE_LEVEL_SELECT,
  type EmsClearanceLevel,
} from "@/lib/ems-clearance-levels-types";

function throwIfMissing(error: { code?: string; message: string } | null) {
  if (isMissingEmsClearanceLevelsTable(error)) {
    throw new Error(
      "EMS clearance levels table is not set up yet. Run the ems_clearance_levels migration, then refresh."
    );
  }
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export type EmsClearanceLevelFormInput = {
  name: string;
  sort_order?: number;
  is_active?: boolean;
  notes?: string;
};

function revalidateEmsClearanceLevels() {
  revalidatePath("/admin");
  revalidatePath("/admin/ems-clearance-levels");
  revalidatePath("/personnel", "layout");
}

export async function createEmsClearanceLevel(input: EmsClearanceLevelFormInput) {
  await requireAdmin();
  const name = emptyToNull(input.name);
  if (!name) throw new Error("Name is required.");

  const supabase = await createSupabaseServerClient();

  let sortOrder = input.sort_order;
  if (sortOrder == null || Number.isNaN(sortOrder)) {
    const { data: maxRow } = await supabase
      .from("ems_clearance_levels")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = (maxRow?.sort_order ?? 0) + 1;
  }

  const { data, error } = await supabase
    .from("ems_clearance_levels")
    .insert({
      name,
      sort_order: sortOrder,
      is_active: input.is_active ?? true,
      notes: input.notes?.trim() ?? "",
    })
    .select(EMS_CLEARANCE_LEVEL_SELECT)
    .single();

  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidateEmsClearanceLevels();
  return data as EmsClearanceLevel;
}

export async function updateEmsClearanceLevel(
  id: string,
  input: EmsClearanceLevelFormInput
) {
  await requireAdmin();
  const name = emptyToNull(input.name);
  if (!name) throw new Error("Name is required.");

  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("ems_clearance_levels")
    .select(EMS_CLEARANCE_LEVEL_SELECT)
    .eq("id", id)
    .maybeSingle();

  throwIfMissing(existingError);
  if (existingError) throw new Error(supabaseErrorMessage(existingError));
  if (!existing) throw new Error("EMS clearance level not found.");

  const previous = existing as EmsClearanceLevel;

  const { data, error } = await supabase
    .from("ems_clearance_levels")
    .update({
      name,
      sort_order: input.sort_order ?? previous.sort_order,
      is_active: input.is_active ?? previous.is_active,
      notes: input.notes?.trim() ?? previous.notes,
    })
    .eq("id", id)
    .select(EMS_CLEARANCE_LEVEL_SELECT)
    .single();

  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidateEmsClearanceLevels();
  return data as EmsClearanceLevel;
}

export async function deleteEmsClearanceLevel(id: string) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("ems_clearance_levels")
    .select(EMS_CLEARANCE_LEVEL_SELECT)
    .eq("id", id)
    .maybeSingle();

  throwIfMissing(existingError);
  if (existingError) throw new Error(supabaseErrorMessage(existingError));
  if (!existing) throw new Error("EMS clearance level not found.");

  const level = existing as EmsClearanceLevel;

  const { count: clearanceCount, error: clearanceCountError } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("ems_cleared_level_id", level.id);

  if (clearanceCountError) throw new Error(supabaseErrorMessage(clearanceCountError));

  const clearances = clearanceCount ?? 0;
  if (clearances > 0) {
    throw new Error(
      `Cannot delete "${level.name}" while it is still used by ${clearances} clearance assignment${clearances === 1 ? "" : "s"}. Deactivate it instead.`
    );
  }

  const { error } = await supabase.from("ems_clearance_levels").delete().eq("id", id);
  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidateEmsClearanceLevels();
}

export async function reorderEmsClearanceLevels(input: {
  emsClearanceLevelIds: string[];
}) {
  await requireAdmin();
  if (input.emsClearanceLevelIds.length === 0) return;

  const supabase = await createSupabaseServerClient();

  for (const [index, id] of input.emsClearanceLevelIds.entries()) {
    const { error } = await supabase
      .from("ems_clearance_levels")
      .update({ sort_order: index + 1 })
      .eq("id", id);
    throwIfMissing(error);
    if (error) throw new Error(supabaseErrorMessage(error));
  }

  revalidateEmsClearanceLevels();
}
