"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/capability-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isMissingEquipmentCategoriesTable,
  supabaseErrorMessage,
} from "@/lib/supabase/errors";
import {
  EQUIPMENT_CATEGORY_SELECT,
  type EquipmentCategory,
} from "@/lib/equipment-categories-types";

function throwIfMissing(error: { code?: string; message: string } | null) {
  if (isMissingEquipmentCategoriesTable(error)) {
    throw new Error(
      "Equipment categories table is not set up yet. Run the equipment fields migration, then refresh."
    );
  }
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export type EquipmentCategoryFormInput = {
  name: string;
  sort_order?: number;
  is_active?: boolean;
  notes?: string;
};

export async function createEquipmentCategory(input: EquipmentCategoryFormInput) {
  await requireCapability("manage_assets");
  const name = emptyToNull(input.name);
  if (!name) throw new Error("Name is required.");

  const supabase = await createSupabaseServerClient();

  let sortOrder = input.sort_order;
  if (sortOrder == null || Number.isNaN(sortOrder)) {
    const { data: maxRow } = await supabase
      .from("equipment_categories")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = (maxRow?.sort_order ?? 0) + 1;
  }

  const { data, error } = await supabase
    .from("equipment_categories")
    .insert({
      name,
      sort_order: sortOrder,
      is_active: input.is_active ?? true,
      notes: input.notes?.trim() ?? "",
    })
    .select(EQUIPMENT_CATEGORY_SELECT)
    .single();

  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidatePath("/admin");
  revalidatePath("/admin/equipment-categories");
  revalidatePath("/assets");
  revalidatePath("/assets/ppe");
  revalidatePath("/assets/new");
  return data as EquipmentCategory;
}

export async function updateEquipmentCategory(id: string, input: EquipmentCategoryFormInput) {
  await requireCapability("manage_assets");
  const name = emptyToNull(input.name);
  if (!name) throw new Error("Name is required.");

  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("equipment_categories")
    .select(EQUIPMENT_CATEGORY_SELECT)
    .eq("id", id)
    .maybeSingle();

  throwIfMissing(existingError);
  if (existingError) throw new Error(supabaseErrorMessage(existingError));
  if (!existing) throw new Error("Category not found.");

  const previous = existing as EquipmentCategory;

  const { data, error } = await supabase
    .from("equipment_categories")
    .update({
      name,
      sort_order: input.sort_order ?? previous.sort_order,
      is_active: input.is_active ?? previous.is_active,
      notes: input.notes?.trim() ?? previous.notes,
    })
    .eq("id", id)
    .select(EQUIPMENT_CATEGORY_SELECT)
    .single();

  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidatePath("/admin");
  revalidatePath("/admin/equipment-categories");
  revalidatePath("/assets");
  revalidatePath("/assets/ppe");
  revalidatePath("/assets/new");
  return data as EquipmentCategory;
}

export async function deleteEquipmentCategory(id: string) {
  await requireCapability("manage_assets");
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("equipment_categories")
    .select(EQUIPMENT_CATEGORY_SELECT)
    .eq("id", id)
    .maybeSingle();

  throwIfMissing(existingError);
  if (existingError) throw new Error(supabaseErrorMessage(existingError));
  if (!existing) throw new Error("Category not found.");

  const category = existing as EquipmentCategory;

  const { count, error: countError } = await supabase
    .from("assets")
    .select("id", { count: "exact", head: true })
    .eq("equipment_category_id", category.id);

  if (countError) throw new Error(supabaseErrorMessage(countError));
  if ((count ?? 0) > 0) {
    throw new Error(
      `Cannot delete "${category.name}" while ${count} item${count === 1 ? "" : "s"} still use it. Deactivate it instead, or reassign those items.`
    );
  }

  const { error } = await supabase.from("equipment_categories").delete().eq("id", id);
  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidatePath("/admin");
  revalidatePath("/admin/equipment-categories");
  revalidatePath("/assets");
  revalidatePath("/assets/ppe");
  revalidatePath("/assets/new");
}

export async function reorderEquipmentCategories(input: { categoryIds: string[] }) {
  await requireCapability("manage_assets");
  if (input.categoryIds.length === 0) return;

  const supabase = await createSupabaseServerClient();

  for (const [index, id] of input.categoryIds.entries()) {
    const { error } = await supabase
      .from("equipment_categories")
      .update({ sort_order: index + 1 })
      .eq("id", id);
    throwIfMissing(error);
    if (error) throw new Error(supabaseErrorMessage(error));
  }

  revalidatePath("/admin");
  revalidatePath("/admin/equipment-categories");
  revalidatePath("/assets");
  revalidatePath("/assets/ppe");
  revalidatePath("/assets/new");
}
