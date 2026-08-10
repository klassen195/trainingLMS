import type { SupabaseClient } from "@supabase/supabase-js";
import {
  QUALIFICATION_SELECT,
  type Qualification,
} from "@/lib/qualifications-types";
import { isMissingQualificationsTable } from "@/lib/supabase/errors";

export async function listQualifications(
  supabase: SupabaseClient,
  options?: { activeOnly?: boolean }
): Promise<{ rows: Qualification[]; error: { code?: string; message: string } | null }> {
  let query = supabase
    .from("qualifications")
    .select(QUALIFICATION_SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (options?.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (isMissingQualificationsTable(error)) {
    return { rows: [], error: null };
  }
  if (error) return { rows: [], error };
  return { rows: (data ?? []) as Qualification[], error: null };
}
