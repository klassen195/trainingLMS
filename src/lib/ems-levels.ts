import type { SupabaseClient } from "@supabase/supabase-js";
import { EMS_LEVEL_SELECT, type EmsLevel } from "@/lib/ems-levels-types";
import { isMissingEmsLevelsTable } from "@/lib/supabase/errors";

export async function listEmsLevels(
  supabase: SupabaseClient,
  options?: { activeOnly?: boolean }
): Promise<{ rows: EmsLevel[]; error: { code?: string; message: string } | null }> {
  let query = supabase
    .from("ems_levels")
    .select(EMS_LEVEL_SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (options?.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (isMissingEmsLevelsTable(error)) {
    return { rows: [], error: null };
  }
  if (error) return { rows: [], error };
  return { rows: (data ?? []) as EmsLevel[], error: null };
}
