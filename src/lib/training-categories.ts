import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_TRAINING_CATEGORY_NAMES,
  TRAINING_CATEGORY_SELECT,
  type TrainingCategory,
} from "@/lib/training-categories-types";
import { isMissingTrainingCategoriesTable } from "@/lib/supabase/errors";

export async function listTrainingCategories(
  supabase: SupabaseClient,
  options?: { activeOnly?: boolean }
): Promise<{ rows: TrainingCategory[]; error: { code?: string; message: string } | null }> {
  let query = supabase
    .from("training_categories")
    .select(TRAINING_CATEGORY_SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (options?.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (isMissingTrainingCategoriesTable(error)) {
    return {
      rows: DEFAULT_TRAINING_CATEGORY_NAMES.map((name, index) => ({
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
  return { rows: (data ?? []) as TrainingCategory[], error: null };
}
