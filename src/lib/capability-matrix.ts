import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  APP_CAPABILITIES,
  defaultCapabilityPlacements,
  emptyCapabilityMatrix,
  normalizeCapabilityPlacements,
  type AppCapability,
  type CapabilityMatrix,
  type CapabilityPlacement,
} from "@/lib/capabilities";
import { listPermissionLevels } from "@/lib/permission-levels";
import type { PermissionLevel } from "@/lib/permission-levels-types";

type CapabilityRow = {
  permission_level_id: string;
  capability: string;
  enabled: boolean;
};

export async function loadCapabilityPlacements(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<CapabilityPlacement[]> {
  const { data, error } = await supabase
    .from("capability_display_order")
    .select("capability, sort_order, group_name, label")
    .order("sort_order", { ascending: true })
    .order("capability", { ascending: true });

  if (error || !data?.length) return defaultCapabilityPlacements();
  return normalizeCapabilityPlacements(
    data.map((row) => ({
      capability: row.capability as string,
      group: (row.group_name as string | null) ?? null,
      label: (row.label as string | null) ?? null,
    }))
  );
}

export const loadCapabilityMatrix = cache(
  async (): Promise<{
    levels: PermissionLevel[];
    matrix: CapabilityMatrix;
    capabilityPlacements: CapabilityPlacement[];
  }> => {
    const supabase = await createSupabaseServerClient();
    const { rows: levels } = await listPermissionLevels(supabase);
    const matrix = emptyCapabilityMatrix(levels.map((level) => level.id));
    const capabilityPlacements = await loadCapabilityPlacements(supabase);

    const { data, error } = await supabase
      .from("permission_level_capabilities")
      .select("permission_level_id, capability, enabled");

    if (error || !data) return { levels, matrix, capabilityPlacements };

    for (const row of data as CapabilityRow[]) {
      if (!(APP_CAPABILITIES as readonly string[]).includes(row.capability)) continue;
      if (!matrix[row.permission_level_id]) continue;
      matrix[row.permission_level_id][row.capability as AppCapability] = row.enabled;
    }
    return { levels, matrix, capabilityPlacements };
  }
);
