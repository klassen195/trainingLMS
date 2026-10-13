import type { SupabaseClient } from "@supabase/supabase-js";
import { PERSONNEL_RANK_SELECT, type PersonnelRank } from "@/lib/ranks-types";
import { isMissingPersonnelRanksTable } from "@/lib/supabase/errors";

export async function listPersonnelRanks(
  supabase: SupabaseClient,
  options?: { activeOnly?: boolean }
): Promise<{ rows: PersonnelRank[]; error: { code?: string; message: string } | null }> {
  let query = supabase
    .from("personnel_ranks")
    .select(PERSONNEL_RANK_SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (options?.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (isMissingPersonnelRanksTable(error)) {
    return { rows: [], error: null };
  }
  if (error) return { rows: [], error };
  return { rows: (data ?? []) as PersonnelRank[], error: null };
}
