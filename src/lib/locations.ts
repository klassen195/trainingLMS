import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_LOCATION_NAMES,
  LOCATION_SELECT,
  type Location,
} from "@/lib/locations-types";
import { isMissingLocationsTable } from "@/lib/supabase/errors";

export async function listLocations(
  supabase: SupabaseClient,
  options?: { activeOnly?: boolean }
): Promise<{ rows: Location[]; error: { code?: string; message: string } | null }> {
  let query = supabase
    .from("locations")
    .select(LOCATION_SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (options?.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (isMissingLocationsTable(error)) {
    return {
      rows: DEFAULT_LOCATION_NAMES.map((name, index) => ({
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
  return { rows: (data ?? []) as Location[], error: null };
}

export function locationNames(locations: Location[]) {
  return locations.map((location) => location.name);
}
