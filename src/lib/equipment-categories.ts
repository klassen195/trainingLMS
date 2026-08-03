import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_EQUIPMENT_CATEGORY_NAMES,
  EQUIPMENT_CATEGORY_SELECT,
  type EquipmentCategory,
} from "@/lib/equipment-categories-types";
import { isMissingEquipmentCategoriesTable } from "@/lib/supabase/errors";

export async function listEquipmentCategories(
  supabase: SupabaseClient,
  options?: { activeOnly?: boolean }
): Promise<{ rows: EquipmentCategory[]; error: { code?: string; message: string } | null }> {
  let query = supabase
    .from("equipment_categories")
    .select(EQUIPMENT_CATEGORY_SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (options?.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (isMissingEquipmentCategoriesTable(error)) {
    return {
      rows: DEFAULT_EQUIPMENT_CATEGORY_NAMES.map((name, index) => ({
        id: `fallback-${index + 1}`,
        created_at: "",
        updated_at: "",
        name,
        sort_order: index + 1,
        is_active: true,
        notes: "",
      })),
      error: null,
    };
  }
  if (error) return { rows: [], error };
  return { rows: (data ?? []) as EquipmentCategory[], error: null };
}
