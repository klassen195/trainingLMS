"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/capability-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isMissingEquipmentSubcategoriesTable,
  supabaseErrorMessage,
} from "@/lib/supabase/errors";
import {
  EQUIPMENT_SUBCATEGORY_SELECT,
  type EquipmentSubcategory,
} from "@/lib/equipment-subcategories-types";

function throwIfMissing(error: { code?: string; message: string } | null) {
  if (isMissingEquipmentSubcategoriesTable(error)) {
    throw new Error(
      "Equipment subcategories table is not set up yet. Run the equipment subcategories migration, then refresh."
    );
  }
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function revalidateSubcategoryPaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/equipment-subcategories");
  revalidatePath("/admin/equipment-categories");
  revalidatePath("/assets");
  revalidatePath("/assets/ppe");
  revalidatePath("/assets/new");
}

export type EquipmentSubcategoryFormInput = {
  equipment_category_id: string;
  name: string;
  sort_order?: number;
  is_active?: boolean;
  notes?: string;
};

export async function createEquipmentSubcategory(input: EquipmentSubcategoryFormInput) {
  await requireCapability("manage_assets");
  const name = emptyToNull(input.name);
  const categoryId = emptyToNull(input.equipment_category_id);
  if (!categoryId) throw new Error("Category is required.");
  if (!name) throw new Error("Name is required.");

  const supabase = await createSupabaseServerClient();

  let sortOrder = input.sort_order;
  if (sortOrder == null || Number.isNaN(sortOrder)) {
    const { data: maxRow } = await supabase
      .from("equipment_subcategories")
      .select("sort_order")
      .eq("equipment_category_id", categoryId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = (maxRow?.sort_order ?? 0) + 1;
  }

  const { data, error } = await supabase
    .from("equipment_subcategories")
    .insert({
      equipment_category_id: categoryId,
      name,
      sort_order: sortOrder,
      is_active: input.is_active ?? true,
      notes: input.notes?.trim() ?? "",
    })
    .select(EQUIPMENT_SUBCATEGORY_SELECT)
    .single();

  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidateSubcategoryPaths();
  return data as EquipmentSubcategory;
}

export async function updateEquipmentSubcategory(
  id: string,
  input: EquipmentSubcategoryFormInput
) {
  await requireCapability("manage_assets");
  const name = emptyToNull(input.name);
  const categoryId = emptyToNull(input.equipment_category_id);
  if (!categoryId) throw new Error("Category is required.");
  if (!name) throw new Error("Name is required.");

  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("equipment_subcategories")
    .select(EQUIPMENT_SUBCATEGORY_SELECT)
    .eq("id", id)
    .maybeSingle();

  throwIfMissing(existingError);
  if (existingError) throw new Error(supabaseErrorMessage(existingError));
  if (!existing) throw new Error("Subcategory not found.");

  const previous = existing as EquipmentSubcategory;

  const { data, error } = await supabase
    .from("equipment_subcategories")
    .update({
      equipment_category_id: categoryId,
      name,
      sort_order: input.sort_order ?? previous.sort_order,
      is_active: input.is_active ?? previous.is_active,
      notes: input.notes?.trim() ?? previous.notes,
    })
    .eq("id", id)
    .select(EQUIPMENT_SUBCATEGORY_SELECT)
    .single();

  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidateSubcategoryPaths();
  return data as EquipmentSubcategory;
}

export async function deleteEquipmentSubcategory(id: string) {
  await requireCapability("manage_assets");
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("equipment_subcategories")
    .select(EQUIPMENT_SUBCATEGORY_SELECT)
    .eq("id", id)
    .maybeSingle();

  throwIfMissing(existingError);
  if (existingError) throw new Error(supabaseErrorMessage(existingError));
  if (!existing) throw new Error("Subcategory not found.");

  const subcategory = existing as EquipmentSubcategory;

  const { count, error: countError } = await supabase
    .from("assets")
    .select("id", { count: "exact", head: true })
    .eq("equipment_subcategory_id", subcategory.id);

  if (countError) throw new Error(supabaseErrorMessage(countError));
  if ((count ?? 0) > 0) {
    throw new Error(
      `Cannot delete "${subcategory.name}" while ${count} item${count === 1 ? "" : "s"} still use it. Deactivate it instead, or reassign those items.`
    );
  }

  const { error } = await supabase.from("equipment_subcategories").delete().eq("id", id);
  throwIfMissing(error);
  if (error) throw new Error(supabaseErrorMessage(error));

  revalidateSubcategoryPaths();
}

export async function reorderEquipmentSubcategories(input: {
  subcategoryIds: string[];
}) {
  await requireCapability("manage_assets");
  if (input.subcategoryIds.length === 0) return;

  const supabase = await createSupabaseServerClient();

  for (const [index, id] of input.subcategoryIds.entries()) {
    const { error } = await supabase
      .from("equipment_subcategories")
      .update({ sort_order: index + 1 })
      .eq("id", id);
    throwIfMissing(error);
    if (error) throw new Error(supabaseErrorMessage(error));
  }

  revalidateSubcategoryPaths();
}
