import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EQUIPMENT_SUBCATEGORY_SELECT,
  EQUIPMENT_SUBCATEGORY_WITH_CATEGORY_SELECT,
  type EquipmentSubcategory,
  type EquipmentSubcategoryWithCategory,
} from "@/lib/equipment-subcategories-types";
import { isMissingEquipmentSubcategoriesTable } from "@/lib/supabase/errors";

function asSingleCategory(
  value: { id: string; name: string } | { id: string; name: string }[] | null | undefined
) {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function listEquipmentSubcategories(
  supabase: SupabaseClient,
  options?: { activeOnly?: boolean; categoryId?: string; withCategory?: boolean }
): Promise<{
  rows: EquipmentSubcategoryWithCategory[];
  error: { code?: string; message: string } | null;
}> {
  const select = options?.withCategory
    ? EQUIPMENT_SUBCATEGORY_WITH_CATEGORY_SELECT
    : EQUIPMENT_SUBCATEGORY_SELECT;

  let query = supabase
    .from("equipment_subcategories")
    .select(select as typeof EQUIPMENT_SUBCATEGORY_WITH_CATEGORY_SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (options?.activeOnly) {
    query = query.eq("is_active", true);
  }
  if (options?.categoryId) {
    query = query.eq("equipment_category_id", options.categoryId);
  }

  const { data, error } = await query;
  if (isMissingEquipmentSubcategoriesTable(error)) {
    return { rows: [], error: null };
  }
  if (error) return { rows: [], error };

  const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => {
    const { equipment_category, ...rest } = row;
    return {
      ...(rest as EquipmentSubcategory),
      equipment_category: options?.withCategory
        ? asSingleCategory(
            equipment_category as
              | { id: string; name: string }
              | { id: string; name: string }[]
              | null
              | undefined
          )
        : undefined,
    };
  });

  return { rows, error: null };
}
