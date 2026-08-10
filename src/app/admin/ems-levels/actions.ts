"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isMissingEmsLevelsTable,
  supabaseErrorMessage,
} from "@/lib/supabase/errors";
import { EMS_LEVEL_SELECT, type EmsLevel } from "@/lib/ems-levels-types";

function throwIfMissing(error: { code?: string; message: string } | null) {
  if (isMissingEmsLevelsTable(error)) {
    throw new Error(
      "EMS levels table is not set up yet. Run the ems_levels migration, then refresh."
    );
  }
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export type EmsLevelFormInput = {
  name: string;
  sort_order?: number;
  is_active?: boolean;
  notes?: string;
};

function revalidateEmsLevels() {
  revalidatePath("/admin");
  revalidatePath("/admin/ems-levels");
  revalidatePath("/personnel", "layout");
}

export async function createEmsLevel(input: EmsLevelFormInput) {
  await requireAdmin();
  const name = emptyToNull(input.name);
  if (!name) throw new Error("Name is required.");

  const supabase = await createSupabaseServerClient();

  let sortOrder = input.sort_order;
  if (sortOrder == null || Number.isNaN(sortOrder)) {
    const { data: maxRow } = await supabase
      .from("ems_levels")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = (maxRow?.sort_order ?? 0) + 1;
  }

  const { data, error } = await supabase
    .from("ems_levels")
    .insert({
      name,
      sort_order: sortOrder,
      is_active: input.is_active ?? true,
      notes: input.notes?.trim() ?? "",
    })
    .select(EMS_LEVEL_SELECT)
    .single();

  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidateEmsLevels();
  return data as EmsLevel;
}

export async function updateEmsLevel(id: string, input: EmsLevelFormInput) {
  await requireAdmin();
  const name = emptyToNull(input.name);
  if (!name) throw new Error("Name is required.");

  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("ems_levels")
    .select(EMS_LEVEL_SELECT)
    .eq("id", id)
    .maybeSingle();

  throwIfMissing(existingError);
  if (existingError) throw new Error(supabaseErrorMessage(existingError));
  if (!existing) throw new Error("EMS level not found.");

  const previous = existing as EmsLevel;

  const { data, error } = await supabase
    .from("ems_levels")
    .update({
      name,
      sort_order: input.sort_order ?? previous.sort_order,
      is_active: input.is_active ?? previous.is_active,
      notes: input.notes?.trim() ?? previous.notes,
    })
    .eq("id", id)
    .select(EMS_LEVEL_SELECT)
    .single();

  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidateEmsLevels();
  return data as EmsLevel;
}

export async function deleteEmsLevel(id: string) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("ems_levels")
    .select(EMS_LEVEL_SELECT)
    .eq("id", id)
    .maybeSingle();

  throwIfMissing(existingError);
  if (existingError) throw new Error(supabaseErrorMessage(existingError));
  if (!existing) throw new Error("EMS level not found.");

  const level = existing as EmsLevel;

  const { count: licenseCount, error: licenseCountError } = await supabase
    .from("personnel_ems_licenses")
    .select("id", { count: "exact", head: true })
    .eq("ems_level_id", level.id);

  if (licenseCountError) throw new Error(supabaseErrorMessage(licenseCountError));

  const licenses = licenseCount ?? 0;
  if (licenses > 0) {
    throw new Error(
      `Cannot delete "${level.name}" while it is still used by ${licenses} personnel license${licenses === 1 ? "" : "s"}. Deactivate it instead.`
    );
  }

  const { error } = await supabase.from("ems_levels").delete().eq("id", id);
  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidateEmsLevels();
}

export async function reorderEmsLevels(input: { emsLevelIds: string[] }) {
  await requireAdmin();
  if (input.emsLevelIds.length === 0) return;

  const supabase = await createSupabaseServerClient();

  for (const [index, id] of input.emsLevelIds.entries()) {
    const { error } = await supabase
      .from("ems_levels")
      .update({ sort_order: index + 1 })
      .eq("id", id);
    throwIfMissing(error);
    if (error) throw new Error(supabaseErrorMessage(error));
  }

  revalidateEmsLevels();
}
