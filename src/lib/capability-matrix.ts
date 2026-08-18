import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  APP_CAPABILITIES,
  emptyCapabilityMatrix,
  type AppCapability,
  type CapabilityMatrix,
} from "@/lib/capabilities";
import { listPermissionLevels } from "@/lib/permission-levels";
import type { PermissionLevel } from "@/lib/permission-levels-types";

type CapabilityRow = {
  permission_level_id: string;
  capability: string;
  enabled: boolean;
};

export const loadCapabilityMatrix = cache(
  async (): Promise<{ levels: PermissionLevel[]; matrix: CapabilityMatrix }> => {
    const supabase = await createSupabaseServerClient();
    const { rows: levels } = await listPermissionLevels(supabase);
    const matrix = emptyCapabilityMatrix(levels.map((level) => level.id));

    const { data, error } = await supabase
      .from("permission_level_capabilities")
      .select("permission_level_id, capability, enabled");

    if (error || !data) return { levels, matrix };

    for (const row of data as CapabilityRow[]) {
      if (!(APP_CAPABILITIES as readonly string[]).includes(row.capability)) continue;
      if (!matrix[row.permission_level_id]) continue;
      matrix[row.permission_level_id][row.capability as AppCapability] = row.enabled;
    }
    return { levels, matrix };
  }
);
