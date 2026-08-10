import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EMS_CLEARANCE_LEVEL_SELECT,
  type EmsClearanceLevel,
} from "@/lib/ems-clearance-levels-types";
import { isMissingEmsClearanceLevelsTable } from "@/lib/supabase/errors";

export async function listEmsClearanceLevels(
  supabase: SupabaseClient,
  options?: { activeOnly?: boolean }
): Promise<{
  rows: EmsClearanceLevel[];
  error: { code?: string; message: string } | null;
}> {
  let query = supabase
    .from("ems_clearance_levels")
    .select(EMS_CLEARANCE_LEVEL_SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (options?.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (isMissingEmsClearanceLevelsTable(error)) {
    return { rows: [], error: null };
  }
  if (error) return { rows: [], error };
  return { rows: (data ?? []) as EmsClearanceLevel[], error: null };
}
