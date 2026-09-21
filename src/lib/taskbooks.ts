import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import {
  TASKBOOK_TYPE_SELECT,
  TASKBOOK_TYPE_WITH_PREREQS_SELECT,
  findTaskbookTypeByName,
  type TaskbookPrerequisiteDef,
  type TaskbookType,
  type TaskbookTypeWithPrerequisites,
} from "@/lib/taskbook-types";

export { findTaskbookTypeByName };

function normalizePrerequisites(
  value: TaskbookPrerequisiteDef[] | TaskbookPrerequisiteDef | null | undefined
): TaskbookPrerequisiteDef[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return [...list].sort(
    (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)
  );
}

export async function listTaskbookTypes(
  supabase: SupabaseClient,
  options?: { activeOnly?: boolean; withPrerequisites?: boolean }
): Promise<{ rows: TaskbookTypeWithPrerequisites[]; error: PostgrestError | null }> {
  let query = supabase
    .from("taskbook_types")
    .select(
      options?.withPrerequisites ? TASKBOOK_TYPE_WITH_PREREQS_SELECT : TASKBOOK_TYPE_SELECT
    )
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (options?.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) return { rows: [], error };

  // Generated DB types may not include taskbook_types yet; cast through unknown.
  const rows = ((data ?? []) as unknown as Array<TaskbookType & { prerequisites?: unknown }>).map(
    (row) => ({
      ...row,
      prerequisites: options?.withPrerequisites
        ? normalizePrerequisites(row.prerequisites as TaskbookPrerequisiteDef[] | null)
        : [],
    })
  );

  return { rows, error: null };
}

export function taskbookPrerequisitesForName(
  types: readonly TaskbookTypeWithPrerequisites[],
  name: string
) {
  return findTaskbookTypeByName(types, name)?.prerequisites ?? [];
}
